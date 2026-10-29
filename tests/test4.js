const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const m = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  res.writeHead(200, { 'Content-Type': m[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }).listen(8093);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 1100 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await ctx.route('https://media.rawg.io/**', r => { const n = r.request().url().match(/c(\d)\.png/)[1]; r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(require('path').join(__dirname, 'fixtures', `c${n}.png`)) }); });
  await page.goto('http://localhost:8093/'); await page.waitForSelector('#tabs button');
  await page.evaluate(async () => {
    const T = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const [i, t] of T.entries()) { const g = { id: 'k' + t, title: 'Juego ' + t, year: 2019, platforms: 'PC', cover: `https://media.rawg.io/c${i}.png`, status: i % 2 ? 'played' : 'backlog', rating: null, hours: null, favorite: i < 5, notes: '', added: 1, updated: 100 - i }; await DB.put(g); games.push(g); }
    render(); });
  const tab = n => page.locator('#tabs button', { hasText: n });
  const titles = async () => (await page.locator('#list .card, #list .tile').evaluateAll(els => els.map(e => e.getAttribute('aria-label')))).map(x => x.replace('Juego ', '')).join('');
  const stored = async () => page.evaluate(() => DB.all().then(a => a.filter(g => g.favorite).sort((x, y) => (x.favRank ?? 1e9) - (y.favRank ?? 1e9) || y.updated - x.updated).map(g => g.title.slice(-1)).join('')));

  await tab('Jugados').click();
  await tab('Favoritos').click();
  ok('"Mi orden" existe en Favoritos', (await page.locator('#sort option[value=custom]').count()) === 1);
  ok('orden por defecto: recientes (ABCDE)', (await titles()) === 'ABCDE');
  ok('sin textos de ayuda en la lista', (await page.locator('#list .hint').count()) === 0);
  const box = async i => (await page.locator('#list .card').nth(i).boundingBox());
  let a, e;
  await page.waitForTimeout(450);

  await page.evaluate(() => { setSort(tab, 'custom'); render(); });
  ok('activa "Mi orden"', (await page.inputValue('#sort')) === 'custom' && (await page.locator('#list.sortable').count()) === 1);
  ok('sigue sin textos de ayuda', (await page.locator('#list .hint').count()) === 0);

  // --- ratón en lista: E (último) al primer puesto
  a = await box(0); e = await box(4);
  await page.mouse.move(e.x + 60, e.y + 40); await page.mouse.down();
  await page.mouse.move(e.x + 60, e.y + 20, { steps: 3 });
  ok('al arrastrar aparece hueco y elemento flotante', (await page.locator('#list .ph').count()) === 1 && (await page.locator('#list .dragging').count()) === 1);
  await page.mouse.move(a.x + 60, a.y + 10, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(150);
  ok('ratón: E al principio → EABCD', (await titles()) === 'EABCD', await titles());
  ok('no abre ficha tras arrastrar', (await page.locator('#dlgEdit[open]').count()) === 0);
  ok('persistido en la base de datos', (await stored()) === 'EABCD', await stored());
  await page.waitForTimeout(450);

  // --- mover B al final (hacia abajo)
  a = await box(2); e = await box(4);
  await page.mouse.move(a.x + 60, a.y + 40); await page.mouse.down(); await page.mouse.move(a.x + 60, a.y + 20, { steps: 3 });
  await page.mouse.move(e.x + 60, e.y + 60, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(150);
  ok('ratón: B al final → EACDB', (await titles()) === 'EACDB', await titles());
  await page.waitForTimeout(450);

  // --- clic normal sigue abriendo la ficha
  await page.locator('#list .card').nth(1).click(); await page.waitForSelector('#dlgEdit[open]');
  ok('clic normal abre la ficha', (await page.inputValue('#eTitle')) === 'Juego A');
  await page.click('#dlgEdit [data-close]');

  // --- persiste tras recargar
  await page.reload(); await page.waitForSelector('#tabs button'); await tab('Favoritos').click();
  ok('orden persiste tras recargar', (await titles()) === 'EACDB', await titles());

  // --- Inicio: carrusel de favoritos sigue el orden
  await tab('Inicio').click();
  const home = (await page.locator('#home .cat').nth(3).locator('.tile').evaluateAll(els => els.map(e => e.getAttribute('aria-label').slice(-1)))).join('');
  ok('carrusel de Inicio respeta el orden', home === 'EACDB', home);

  // --- cuadrícula (ratón)
  await tab('Favoritos').click(); await page.click('#vt [data-v=grid]');
  ok('cuadrícula sortable', (await page.locator('#list.grid.sortable .tile').count()) === 5);
  let t0 = await page.locator('#list .tile').nth(0).boundingBox(), t3 = await page.locator('#list .tile').nth(3).boundingBox();
  await page.mouse.move(t3.x + 30, t3.y + 40); await page.mouse.down(); await page.mouse.move(t3.x + 20, t3.y + 30, { steps: 3 });
  await page.mouse.move(t0.x + 30, t0.y + 40, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(150);
  ok('cuadrícula: D al principio → DEACB', (await titles()) === 'DEACB', await titles());
  await page.waitForTimeout(450);

  // --- táctil: pulsación larga con CDP
  await page.click('#vt [data-v=list]');
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  a = await box(0); e = await box(3);
  await touch('touchStart', e.x + 60, e.y + 40);
  await page.waitForTimeout(500);
  ok('pulsación larga activa el arrastre', (await page.locator('#list .dragging').count()) === 1);
  for (let i = 1; i <= 12; i++) { await touch('touchMove', e.x + 60, e.y + 40 + (a.y + 10 - e.y - 40) * i / 12); await page.waitForTimeout(16); }
  await touch('touchEnd'); await page.waitForTimeout(200);
  const afterTouch = await titles();
  ok('táctil: el de la 4ª posición pasa a la 1ª', afterTouch[0] === 'C' && afterTouch.length === 5, afterTouch);
  await page.waitForTimeout(450);

  // --- táctil: mover el dedo antes de los 350ms = scroll, no arrastre
  const before = await titles(); a = await box(1);
  await touch('touchStart', a.x + 60, a.y + 40); await page.waitForTimeout(80);
  await touch('touchMove', a.x + 60, a.y + 90); await page.waitForTimeout(500); await touch('touchEnd'); await page.waitForTimeout(100);
  ok('mover antes de la pulsación larga no arrastra', (await page.locator('#list .dragging').count()) === 0 && (await titles()) === before);

  // --- con filtro no se reordena
  await page.fill('#q', 'Juego'); 
  ok('con filtro: sin sortable y sin aviso', (await page.locator('#list .hint').count()) === 0 && (await page.locator('#list.sortable').count()) === 0);
  await page.fill('#q', '');

  // --- nuevo favorito va al final
  await page.evaluate(async () => { const g = games.find(x => x.id === 'kF'); g.favorite = true; g.updated = Date.now(); await DB.put(g); render(); });
  const t = await titles(); ok('nuevo favorito (F) al final', t[t.length - 1] === 'F' && t.length === 6, t);

  // --- cambiar de categoría y volver mantiene; en otra categoría "custom" cae a recientes
  await tab('Backlog').click(); ok('el orden elegido se mantiene en otras categorías', (await page.inputValue('#sort')) === 'custom');

  // --- lista larga: autoscroll al arrastrar cerca del borde inferior
  await page.evaluate(async () => { for (let i = 0; i < 14; i++) { const g = { id: 'z' + i, title: 'Extra ' + String(i).padStart(2, '0'), year: 2019, platforms: 'PC', cover: '', status: 'backlog', rating: null, hours: null, favorite: true, favRank: 100 + i, notes: '', added: 1, updated: 1 }; await DB.put(g); games.push(g); } render(); });
  await tab('Favoritos').click(); await page.click('#vt [data-v=list]');
  await page.setViewportSize({ width: 390, height: 700 }); await page.waitForTimeout(100);
  const first = await page.locator('#list .card').nth(0).boundingBox();
  await page.mouse.move(first.x + 60, first.y + 40); await page.mouse.down(); await page.mouse.move(first.x + 60, first.y + 70, { steps: 4 });
  await page.mouse.move(first.x + 60, 690, { steps: 6 });
  await page.waitForTimeout(1200);
  const scrolled = await page.evaluate(() => scrollY);
  ok('autoscroll al acercarse al borde inferior', scrolled > 200, 'scrollY=' + scrolled);
  await page.mouse.up(); await page.waitForTimeout(200);
  const order = await titles();
  ok('el juego arrastrado ya no es el primero', order[0] !== 'E' && !order.startsWith('E'), order.slice(0, 5));
  ok('siguen todos los juegos (20)', (await page.locator('#list .card').count()) === 20);
  // --- exportar incluye favRank
  await page.click('#btnSettings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exp')]);
  await dl.saveAs('exp4.json'); const exp = JSON.parse(fs.readFileSync('exp4.json', 'utf8'));
  ok('exportación incluye favRank', exp.games.some(g => typeof g.favRank === 'number'));
  ok('sin errores', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' fallos de ' + out.length);
  await b.close(); srv.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
