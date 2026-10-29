const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const m = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  res.writeHead(200, { 'Content-Type': m[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }).listen(8092);
var errs = []; const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 1400 } });
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  page.on('dialog', d => { errs.push('DIÁLOGO NATIVO: ' + d.type() + ' ' + d.message()); d.dismiss(); }); await page.addInitScript(() => setInterval(() => { const d = document.getElementById('dlgAsk'); if (d && d.open) document.getElementById('askYes').click(); }, 40));
  await ctx.route('https://media.rawg.io/**', r => { const n = r.request().url().match(/c(\d)\.png/)[1]; r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(require('path').join(__dirname, 'fixtures', `c${n}.png`)) }); });
  await page.goto('http://localhost:8092/'); await page.waitForSelector('#tabs button');
  const seed = async () => page.evaluate(async () => { await DB.replaceAll([]); games = [];
    const T = [['A', 'backlog', 1], ['B', 'backlog', 0], ['C', 'backlog', 0], ['J', 'playing', 0], ['K', 'played', 1]];
    for (const [i, [t, s, f]] of T.entries()) { const g = { id: 'k' + t, title: 'Juego ' + t, year: 2019, platforms: 'PC', cover: `https://media.rawg.io/c${i}.png`, status: s, rating: null, hours: null, favorite: !!f, notes: '', added: 1, updated: 100 - i }; await DB.put(g); games.push(g); } render(); });
  await seed();
  const cdp = await ctx.newCDPSession(page); const touch = (t, x, y) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: t === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const db = id => page.evaluate(i => DB.all().then(a => a.find(g => g.id === i)), id);
  const press = async (sel, hold = 600, dy = 0) => { const bx = await page.locator(sel).boundingBox(); const x = bx.x + bx.width / 2, y = bx.y + bx.height / 2;
    await touch('touchStart', x, y); await page.waitForTimeout(hold); if (dy) { for (let i = 1; i <= 6; i++) await touch('touchMove', x, y + dy * i / 6); } await touch('touchEnd', x, y + dy); await page.waitForTimeout(350); };
  const menu = async () => (await page.locator('#dlgMenu[open] .mi, #dlgMenu[open] .lbl').allInnerTexts()).join('|');
  const open = async () => (await page.locator('#dlgMenu[open]').count()) === 1;
  const tab = n => page.click(`#tabs button:has-text("${n}")`);

  const anyOpen = async () => (await page.locator('dialog[open]').count()) > 0;
  const openName = async () => page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map(d => d.id).join(','));
  const closeAll = async () => { await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close())); await page.waitForTimeout(300); };
  // ---- lista Backlog: ya no hay menú al mantener pulsado
  await tab('Backlog');
  await page.evaluate(() => { sortBy = 'recent'; render(); });
  await press('#list .card:has-text("Juego B")');
  ok('Backlog: mantener y soltar no abre ningún menú (a lo sumo la ficha, como un toque)', (await openName()) === '' || (await openName()) === 'dlgEdit', await openName()); await closeAll();
  ok('no existe el diálogo de menú', (await page.locator('#dlgMenu').count()) === 0);
  await press('#list .card:has-text("Juego B")', 600, 60); ok('mantener y mover: no abre nada', !(await anyOpen()), await openName()); await closeAll();
  await page.click('#list .card:has-text("Juego C")'); await page.waitForSelector('#dlgEdit[open]'); ok('tap normal abre la ficha', true); await page.click('#dlgEdit [data-close]'); await page.waitForTimeout(300);
  await press('#list .card:has-text("Juego C")', 80); await page.waitForSelector('#dlgEdit[open]'); await page.click('#dlgEdit [data-close]'); await page.waitForTimeout(300);
  await page.click('#list .card:has-text("Juego A")', { button: 'right' }); ok('clic derecho: no abre menú propio', !(await anyOpen()), await openName());
  // ---- orden personalizado: soltar sin mover no abre nada; mover = arrastre
  await page.evaluate(() => { sortBy = 'custom'; render(); });
  await press('#list .card:has-text("Juego A")'); ok('orden personalizado: mantener y soltar no abre ningún menú', (await openName()) === '' || (await openName()) === 'dlgEdit', await openName()); await closeAll();
  await press('#list .card:has-text("Juego A")', 600, 40); ok('orden personalizado: mover = arrastre, sin diálogos', !(await anyOpen()));
  // ---- Favoritos
  await tab('Favoritos'); await press('#list .card >> nth=0'); ok('Favoritos: mantener y soltar no abre ningún menú', (await openName()) === '' || (await openName()) === 'dlgEdit', await openName()); await closeAll();
  // ---- Home
  await tab('Inicio');
  await press('#home .strip[data-cat=backlog] .tile >> nth=0'); ok('Inicio: mantener y soltar no abre ningún menú', (await openName()) === '' || (await openName()) === 'dlgEdit', await openName()); await closeAll();
  await page.click('#home .strip[data-cat=backlog] .tile >> nth=0', { button: 'right' }); ok('Inicio: clic derecho no abre menú', !(await anyOpen()));
  await page.click('#home .strip[data-cat=backlog] .tile >> nth=0'); await page.waitForSelector('#dlgEdit[open]'); ok('Inicio: tap abre la ficha', true); await page.click('#dlgEdit [data-close]');
  ok('sin errores', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length);
  await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 500)); process.exit(1); } })();
