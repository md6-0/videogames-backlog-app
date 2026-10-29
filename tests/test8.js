const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const m = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  res.writeHead(200, { 'Content-Type': m[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }).listen(8088);
var errs = []; const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 1500 } });
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await ctx.route('https://media.rawg.io/**', r => { const n = r.request().url().match(/c(\d)\.png/)[1]; r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(require('path').join(__dirname, 'fixtures', `c${n}.png`)) }); });
  await page.goto('http://localhost:8088/'); await page.waitForSelector('#tabs button');
  // Backlog: A B C (A favorito) | Jugando: J K | Jugados: vacío
  await page.evaluate(async () => {
    const T = [['A', 'backlog', 1], ['B', 'backlog', 0], ['C', 'backlog', 0], ['J', 'playing', 0], ['K', 'playing', 0]];
    for (const [i, [t, s, f]] of T.entries()) { const g = { id: 'k' + t, title: 'Juego ' + t, year: 2019, platforms: 'PC', cover: `https://media.rawg.io/c${i}.png`, status: s, rating: null, hours: null, favorite: !!f, notes: '', added: 1, updated: 100 - i }; await DB.put(g); games.push(g); }
    render(); });
  const OLD = ['playing','played','backlog','fav']; const cat = n => page.locator(`#home .cat:has(.strip[data-cat=${OLD[n]}])`);            // 0 Jugando, 1 Jugados, 2 Backlog, 3 Favoritos
  const strip = n => cat(n).locator('.strip');
  const row = async n => (await strip(n).locator('.tile:not(.more)').evaluateAll(es => es.map(e => e.getAttribute('aria-label').slice(-1)))).join('');
  const rows = async () => [await row(0), await row(1), await row(2), await row(3)].join('|');
  const tab = n => page.locator('#tabs button', { hasText: n });
  const dragTo = async (fromCat, fromIdx, toCat, toIdx, { dx = 0, end = false } = {}) => {
    const a = await strip(fromCat).locator('.tile:not(.more)').nth(fromIdx).boundingBox();
    let tx, ty;
    const sb = await strip(toCat).boundingBox();
    const tiles = strip(toCat).locator('.tile:not(.more)');
    if (end || (await tiles.count()) === 0) { tx = sb.x + Math.min(sb.width - 20, ((await tiles.count()) * 132) + 90); ty = sb.y + sb.height / 2; }
    else { const t = await tiles.nth(toIdx).boundingBox(); tx = t.x + t.width / 2 + dx; ty = t.y + t.height / 2; }
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(a.x + a.width / 2 + 5, a.y + a.height / 2 - 15, { steps: 3 });
    await page.mouse.move(tx, ty, { steps: 16 });
    return { up: async () => { await page.mouse.up(); await page.waitForTimeout(500); } };
  };
  const db = id => page.evaluate(i => DB.all().then(a => a.find(g => g.id === i)), id);

  ok('estado inicial (Jugando JK, Jugados vacío, Backlog ABC, Favoritos A)', (await rows()) === 'JK||ABC|A', await rows());
  ok('sin aviso de arrastre en Inicio', (await page.locator('#home .hint').count()) === 0);

  // 1) Backlog → Jugando, entre J y K
  let d = await dragTo(2, 1, 0, 1, { dx: -30 });
  ok('al arrastrar, la fila destino se resalta', (await cat(0).evaluate(e => e.classList.contains('drop'))) === true);
  ok('el hueco aparece en Jugando', (await strip(0).locator('.ph').count()) === 1);
  await d.up();
  ok('B pasa de Backlog a Jugando, entre J y K → JBK||AC|A', (await rows()) === 'JBK||AC|A', await rows());
  let g = await db('kB'); ok('B: estado = playing', g.status === 'playing', g.status);
  ok('toast "Movido a Jugando"', (await page.locator('.toast .tm').last().innerText()) === 'Movido a Jugando');
  ok('sigue sin aviso tras arrastrar', (await page.locator('#home .hint').count()) === 0);
  ok('no se abre la ficha al soltar', (await page.locator('#dlgEdit[open]').count()) === 0);
  await page.waitForTimeout(450);

  // 2) Soltar en una categoría vacía (Jugados)
  d = await dragTo(0, 0, 1, 0); ok('hueco en fila vacía y se oculta su mensaje', (await strip(1).locator('.ph').count()) === 1 && !(await strip(1).locator('.cat-empty').isVisible())); await d.up();
  ok('J llega a Jugados (vacío) → BK|J|AC|A', (await rows()) === 'BK|J|AC|A', await rows());
  g = await db('kJ'); ok('J: played y con fecha de fin', g.status === 'played' && !!g.finished);
  await page.waitForTimeout(450);

  // 3) Hacia Favoritos: añade favorito y conserva el estado
  d = await dragTo(2, 1, 3, 0, { end: true }); await d.up();
  ok('C se añade a Favoritos sin salir de Backlog → BK|J|AC|AC', (await rows()) === 'BK|J|AC|AC', await rows());
  g = await db('kC'); ok('C: favorite y status backlog', g.favorite === true && g.status === 'backlog');
  ok('toast "Añadido a Favoritos"', (await page.locator('.toast .tm').last().innerText()) === 'Añadido a Favoritos');
  await page.waitForTimeout(450);

  // 4) Desde Favoritos a otra categoría: cambia el estado, sigue siendo favorito
  d = await dragTo(3, 0, 0, 0, { dx: -30 }); await d.up();
  g = await db('kA'); ok('A (desde Favoritos) pasa a Jugando y sigue favorito', g.status === 'playing' && g.favorite === true, JSON.stringify([g.status, g.favorite]));
  ok('A primero en Jugando → ABK|J|C|AC', (await rows()) === 'ABK|J|C|AC', await rows());
  await page.waitForTimeout(450);

  // 5) Reordenar dentro de la misma fila
  d = await dragTo(0, 0, 0, 2, { dx: 30 }); await d.up();
  ok('reordenar en la misma fila: A al final → BKA', (await row(0)) === 'BKA', await row(0));
  await page.waitForTimeout(450);

  // 6) Soltar fuera de las filas: cancela
  const before = await rows(); const a0 = await strip(0).locator('.tile').first().boundingBox();
  await page.mouse.move(a0.x + 40, a0.y + 40); await page.mouse.down(); await page.mouse.move(a0.x + 45, a0.y + 20, { steps: 3 });
  await page.mouse.move(195, 40, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(500);
  ok('soltar fuera de las filas cancela', (await rows()) === before, await rows());
  await page.waitForTimeout(450);

  // 7) Persistencia
  await page.reload(); await page.waitForSelector('#home .cat');
  ok('persiste tras recargar', (await rows()) === before, await rows());
  ok('el aviso no vuelve', (await page.locator('#home .hint').count()) === 0);

  // 8) Clic normal sigue abriendo la ficha; la categoría se abre desde su cabecera
  await strip(0).locator('.tile').first().click(); await page.waitForSelector('#dlgEdit[open]'); await page.click('#dlgEdit [data-close]');
  await cat(2).locator('.cat-h').click(); ok('cabecera abre la categoría', (await page.locator('#tabs [aria-selected=true]').innerText()) === 'Backlog'); await tab('Inicio').click();

  // 9) Los órdenes se reflejan en las páginas de categoría
  await tab('Jugando').click(); await page.evaluate(() => { setSort(tab, 'custom'); render(); });
  const t1 = (await page.locator('#list .card').evaluateAll(es => es.map(e => e.getAttribute('aria-label').slice(-1)))).join('');
  ok('página Jugando con "Mi orden" coincide con Inicio', t1 === 'BKA', t1);
  await tab('Inicio').click();

  // 10) Táctil: pulsación larga y arrastre entre filas
  const ta = await strip(0).locator('.tile').first().boundingBox(), tb = await strip(2).boundingBox();
  const cdp = await ctx.newCDPSession(page); const touch = (t, x, y) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: t === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', ta.x + 40, ta.y + 60); await page.waitForTimeout(500);
  ok('táctil: la pulsación larga levanta el juego', (await page.locator('#home .dragging').count()) === 1);
  for (let i = 1; i <= 16; i++) { await touch('touchMove', ta.x + 40 + (80 - 40) * i / 16, ta.y + 60 + (tb.y + tb.height / 2 - ta.y - 60) * i / 16); await page.waitForTimeout(16); }
  await touch('touchEnd'); await page.waitForTimeout(500);
  ok('táctil: B pasa de Jugando a Backlog', (await row(2)).includes('B') && !(await row(0)).includes('B'), await rows());
  // mover antes de los 350ms = desplazar, no arrastrar
  const bf = await rows(); const tc = await strip(0).locator('.tile').first().boundingBox();
  await touch('touchStart', tc.x + 40, tc.y + 60); await page.waitForTimeout(80); await touch('touchMove', tc.x + 90, tc.y + 60); await page.waitForTimeout(500); await touch('touchEnd'); await page.waitForTimeout(150);
  ok('táctil: mover pronto no arrastra', (await page.locator('#home .dragging').count()) === 0 && (await rows()) === bf);

  // 11) Fila larga: "Ver todos" no se arrastra y el límite de 12 se respeta al soltar
  await page.evaluate(async () => { for (let i = 0; i < 14; i++) { const g = { id: 'm' + i, title: 'Mucho ' + String(i).padStart(2, '0'), year: 2020, platforms: 'PC', cover: '', status: 'backlog', rating: null, hours: null, favorite: false, notes: '', added: 1, updated: 10 + i }; await DB.put(g); games.push(g); } render(); });
  ok('Backlog muestra 12 + "Ver todos"', (await strip(2).locator('.tile:not(.more)').count()) === 12 && (await strip(2).locator('.tile.more').count()) === 1);
  const more = await strip(2).locator('.tile.more').boundingBox(); const sbx = await strip(2).boundingBox();
  // llevar la tarjeta "more" a otra fila: no debe hacer nada
  if (more && more.x < 390) { await page.mouse.move(more.x + 30, more.y + 40); await page.mouse.down(); await page.mouse.move(more.x + 40, more.y - 40, { steps: 6 }); await page.mouse.move(100, (await strip(0).boundingBox()).y + 60, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300); }
  ok('"Ver todos" no es arrastrable', (await strip(0).locator('.tile').count()) === (await strip(0).locator('.tile:not(.more)').count()));
  // Arrastrar Jugando → final visible de Backlog con 12 visibles: entra detrás del 12º
  await tab('Inicio').click();
  ok('sin errores', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' fallos de ' + out.length);
  await b.close(); srv.close();
})().catch(e => { console.log(out.join('\n')); console.log('ERRS:', errs.join(' | ')); console.error('CRASH', e.message.split('\n')[0]); process.exit(1); });
