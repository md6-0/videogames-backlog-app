const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const m = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  res.writeHead(200, { 'Content-Type': m[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }).listen(8094);
const out = []; const ok = (n, c) => out.push((c ? 'OK   ' : 'FAIL ') + n);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await ctx.route('https://media.rawg.io/**', r => { const n = r.request().url().match(/c(\d)\.png/)[1]; r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(require('path').join(__dirname, 'fixtures', `c${n}.png`)) }); });
  await page.goto('http://localhost:8094/'); await page.waitForSelector('#tabs button');
  await page.evaluate(async () => {
    for (const [i,[t, c, r, h, f]] of [['Disco Elysium', 4, 10, 28, 1], ['Outer Wilds', 5, 9.5, 22, 1], ['Inside', 6, 8.5, 4, 0], ['Sin portada con un título bastante largo', -1, null, 1500.5, 0], ['Balatro', 7, 0, null, 0], ['Hades', 1, 9, 34, 1], ['Celeste', 2, null, 6, 0]].entries()) {
      const g = { id: 'k' + i, title: t, year: 2019, platforms: 'PC', cover: c < 0 ? '' : `https://media.rawg.io/c${c}.png`, status: 'played', rating: r, hours: h, favorite: !!f, notes: '', added: 1, updated: 100 - i };
      await DB.put(g); games.push(g);
    }
    render(); });
  const vt = page.locator('#vt'), tab = n => page.locator('#tabs button', { hasText: n });
  ok('selector oculto en Inicio', await vt.isHidden());
  await tab('Jugados').click();
  ok('selector visible en categoría', await vt.isVisible());
  ok('por defecto: lista', (await page.locator('#vt [aria-pressed=true]').getAttribute('data-v')) === 'list' && (await page.locator('#list .card').count()) === 7);
  await page.click('#vt [data-v=grid]');
  ok('cuadrícula: 7 tiles y 0 cards', (await page.locator('#list .tile').count()) === 7 && (await page.locator('#list .card').count()) === 0);
  ok('grid activo', (await page.locator('#list').evaluate(e => e.classList.contains('grid'))));
  const cols = await page.locator('#list').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  ok('3 columnas en 360px', cols === 3);
  ok('sin scroll horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  ok('corazón en favoritos', (await page.locator('#list .tile .hrt').count()) === 3);
  ok('nota en tile', (await page.locator('#list .tile .chip').allInnerTexts()).includes('10'));
  await page.screenshot({ path: 'grid.png' });
  await page.fill('#q', 'ins'); ok('filtro en cuadrícula', (await page.locator('#list .tile').count()) === 1); await page.fill('#q', '');
  await page.evaluate(() => { setSort(tab, 'rating'); render(); }); ok('orden en cuadrícula (nota más alta)', (await page.locator('#list .tile').first().getAttribute('aria-label')) === 'Disco Elysium'); 
  await page.locator('#list .tile[aria-label="Inside"]').click(); await page.waitForSelector('#dlgEdit[open]');
  ok('tocar tile abre la ficha', (await page.inputValue('#eTitle')) === 'Inside');
  await page.click('#dlgEdit [data-close]');
  await page.reload(); await page.waitForSelector('#tabs button'); await tab('Jugados').click();
  ok('la elección persiste tras recargar', (await page.locator('#list .tile').count()) === 7 && (await page.locator('#vt [aria-pressed=true]').getAttribute('data-v')) === 'grid');
  await tab('Favoritos').click();
  ok('Favoritos en cuadrícula sin corazones duplicados', (await page.locator('#list .tile').count()) === 3 && (await page.locator('#list .tile .hrt').count()) === 0);
  await tab('Backlog').click();
  ok('vacío en cuadrícula ocupa todo el ancho', (await page.locator('#list .empty').count()) === 1 && (await page.locator('#list .empty').evaluate(e => e.getBoundingClientRect().width > 250)));
  await tab('Inicio').click(); ok('Inicio sigue igual (carruseles)', (await page.locator('#home .cat').count()) === 4 && await vt.isHidden());
  await tab('Jugados').click(); await page.click('#vt [data-v=list]');
  ok('volver a lista', (await page.locator('#list .card').count()) === 7 && (await page.locator('#list .tile').count()) === 0);
  await page.screenshot({ path: 'list.png' });
  ok('sin errores', errs.length === 0);
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' fallos de ' + out.length);
  await b.close(); srv.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
