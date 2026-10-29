const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const m = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  res.writeHead(200, { 'Content-Type': m[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }).listen(8089);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 1300 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await page.goto('http://localhost:8089/'); await page.waitForSelector('#tabs button');
  await page.evaluate(async () => {
    const T = [['A', 'backlog', 1], ['B', 'backlog', 0], ['C', 'backlog', 0], ['D', 'backlog', 0], ['E', 'backlog', 0], ['F', 'backlog', 0], ['G', 'played', 1], ['H', 'played', 0], ['I', 'played', 0], ['J', 'playing', 0], ['K', 'playing', 0]];
    for (const [i, [t, s, f]] of T.entries()) { const g = { id: 'k' + t, title: 'Juego ' + t, year: 2019, platforms: 'PC', cover: '', status: s, rating: null, hours: null, favorite: !!f, notes: '', added: 1, updated: 100 - i }; await DB.put(g); games.push(g); }
    render(); });
  const tab = n => page.locator('#tabs button', { hasText: n });
  const titles = async () => (await page.locator('#list .card, #list .tile').evaluateAll(es => es.map(e => e.getAttribute('aria-label').slice(-1)))).join('');
  const db = (key, status) => page.evaluate(([k, st]) => DB.all().then(a => a.filter(g => st === 'fav' ? g.favorite : g.status === st).sort((x, y) => (x[k] ?? 1e9) - (y[k] ?? 1e9) || y.updated - x.updated).map(g => g.title.slice(-1)).join('')), [key, status]);
  const drag = async (from, to, sel = '#list .card') => {
    const a = await page.locator(sel).nth(from).boundingBox(), c = await page.locator(sel).nth(to).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 - 20, { steps: 3 });
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 14 }); await page.mouse.up(); await page.waitForTimeout(500);
  };

  // Backlog
  await tab('Backlog').click();
  ok('Backlog: orden inicial = recientes (ABCDEF)', (await titles()) === 'ABCDEF');
  await page.evaluate(() => { setSort(tab, 'custom'); render(); });
  ok('Backlog: "Mi orden" activo y lista arrastrable', (await page.locator('#list.sortable').count()) === 1 && (await page.locator('#list .hint').count()) === 0);
  await drag(5, 0);
  ok('Backlog: F al principio → FABCDE', (await titles()) === 'FABCDE', await titles());
  ok('Backlog: guardado en "rank"', (await db('rank', 'backlog')) === 'FABCDE', await db('rank', 'backlog'));
  await drag(1, 4);
  ok('Backlog: A al puesto 5 → FBCDAE', (await titles()) === 'FBCDAE', await titles());

  // independencia entre categorías
  await tab('Jugados').click();
  ok('Jugados: no se ve afectada (GHI)', (await titles()) === 'GHI', await titles());
  ok('Jugados: ya no es reordenable a mano', (await page.locator('#list.sortable').count()) === 0);
  await tab('Favoritos').click();
  ok('Favoritos: sin tocar (A, G por recientes)', (await titles()) === 'AG', await titles());
  await drag(1, 0);
  ok('Favoritos: G primero → GA', (await titles()) === 'GA', await titles());
  ok('Favoritos usa "favRank" y no "rank"', (await db('favRank', 'fav')) === 'GA');
  await tab('Backlog').click(); ok('Backlog sigue igual tras mover Favoritos', (await titles()) === 'FBCDAE', await titles());
  await tab('Jugados').click(); ok('Jugados sigue igual tras mover Favoritos', (await titles()) === 'GHI', await titles());

  // Inicio sigue el orden
  await tab('Inicio').click();
  const OLD = ['playing','played','backlog','fav']; const home = async n => (await page.locator(`#home .cat:has(.strip[data-cat=${OLD[n]}])`).locator('.tile').evaluateAll(es => es.map(e => e.getAttribute('aria-label').slice(-1)))).join('');
  ok('Inicio: Backlog en su orden', (await home(2)) === 'FBCDAE', await home(2));
  ok('Inicio: Jugados en su orden', (await home(1)) === 'GHI', await home(1));
  ok('Inicio: Favoritos en su orden', (await home(3)) === 'GA', await home(3));
  ok('Inicio: Jugando (sin ordenar) por recientes', (await home(0)) === 'JK', await home(0));

  // categoría nueva sin orden propio: el que llega queda el primero (recientes); con orden propio: al final
  await tab('Jugando').click(); await drag(1, 0);
  ok('Jugando: K primero → KJ', (await titles()) === 'KJ', await titles());
  await tab('Backlog').click();
  await page.locator('#list .card').nth(2).click(); await page.waitForSelector('#dlgEdit[open]');
  ok('ficha del tercero (C)', (await page.inputValue('#eTitle')) === 'Juego C');
  await page.locator('#eStatus button', { hasText: 'Jugando' }).click(); await page.click('#eSave'); await page.waitForTimeout(300);
  ok('C salta a Jugando y queda al final (KJC)', (await page.locator('#tabs [aria-selected=true]').innerText()) === 'Jugando' && (await titles()) === 'KJC', await titles());
  ok('C recibe posición nueva en Jugando (rank=2)', await page.evaluate(() => games.find(g => g.id === 'kC').rank === 2));
  await tab('Backlog').click(); ok('Backlog sin C conserva el orden (FBDAE)', (await titles()) === 'FBDAE', await titles());

  // juego nuevo en categoría ordenada: al final
  await tab('Backlog').click(); await page.click('#fab'); await page.click('#manual'); await page.waitForSelector('#dlgEdit[open]');
  await page.fill('#eTitle', 'Juego Z'); await page.click('#eSave'); await page.waitForTimeout(300);
  ok('Juego nuevo en Backlog ordenado va al final (FBDAEZ)', (await titles()) === 'FBDAEZ', await titles());
  // marcar favorito → al final de Favoritos; quitarlo → limpia su posición
  await page.locator('#list .card').nth(2).click(); await page.waitForSelector('#dlgEdit[open]'); await page.click('#eFav'); await page.click('#eSave'); await page.waitForTimeout(300);
  await tab('Favoritos').click(); ok('Nuevo favorito (D) al final de Favoritos (GAD)', (await titles()) === 'GAD', await titles());
  await page.locator('#list .card').nth(2).click(); await page.waitForSelector('#dlgEdit[open]'); await page.click('#eFav'); await page.click('#eSave'); await page.waitForTimeout(300);
  ok('Quitar favorito limpia favRank', await page.evaluate(() => games.find(g => g.id === 'kD').favRank == null) && (await titles()) === 'GA', await titles());
  await tab('Backlog').click();
  // cuadrícula
  await page.click('#vt [data-v=grid]');
  await drag(4, 0, '#list .tile');
  ok('Cuadrícula Backlog: E al principio → EFBDAZZ', (await titles()) === 'EFBDAZ', await titles());
  await page.click('#vt [data-v=list]');

  // persistencia, filtro, exportación
  await page.reload(); await page.waitForSelector('#tabs button'); await tab('Backlog').click();
  ok('Persiste tras recargar (EFBDAZ)', (await titles()) === 'EFBDAZ', await titles());
  ok('"Mi orden" recordado tras recargar', (await page.inputValue('#sort')) === 'custom');
  await page.fill('#q', 'Juego'); ok('Con filtro no se reordena', (await page.locator('#list.sortable').count()) === 0); await page.fill('#q', '');
  await page.evaluate(() => { setSort(tab, 'custom'); render(); });
  await page.click('#btnSettings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exp')]); await dl.saveAs('exp7.json');
  const exp = JSON.parse(fs.readFileSync('exp7.json', 'utf8')); ok('Exportación incluye rank y favRank', exp.games.some(g => typeof g.rank === 'number') && exp.games.some(g => typeof g.favRank === 'number'));
  // importar conserva el orden
  await page.click('#dlgSet [data-close]');
  await page.evaluate(async () => { for (const g of games) { g.rank = null; g.favRank = null; await DB.put(g); } render(); });
  await page.click('#btnSettings'); page.on('dialog', d => { errs.push('DIÁLOGO NATIVO'); d.dismiss(); }); await page.addInitScript(() => 0); await page.evaluate(() => setInterval(() => { const d = document.getElementById('dlgAsk'); if (d && d.open) document.getElementById('askYes').click(); }, 40)); await page.setInputFiles('#file', 'exp7.json'); await page.waitForTimeout(500);
  await tab('Backlog').click(); ok('Importar restaura el orden (EFBDAZ)', (await titles()) === 'EFBDAZ', await titles());
  ok('sin errores', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' fallos de ' + out.length);
  await b.close(); srv.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
