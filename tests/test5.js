const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const m = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  res.writeHead(200, { 'Content-Type': m[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }).listen(8091);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
const VPS = [['phone', 390, 844], ['ipad-v', 768, 1024], ['ipad-pro11-v', 834, 1194], ['ipad-h', 1024, 768], ['ipad-pro13-h', 1366, 1024]];
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h] of VPS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 900, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await ctx.route('https://media.rawg.io/**', r => { const n = r.request().url().match(/c(\d)\.png/)[1]; r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(require('path').join(__dirname, 'fixtures', `c${n}.png`)) }); });
    await page.goto('http://localhost:8091/'); await page.waitForSelector('#tabs button');
    await page.evaluate(async () => {
      const names = ['Hollow Knight', 'Hades', 'Celeste', 'Outer Wilds', 'Inside', 'Balatro', 'Tunic', 'Disco Elysium', 'Stardew Valley', 'Elden Ring', 'Pentiment', 'Hi-Fi Rush', 'Cuphead', 'Spiritfarer'];
      const st = ['playing', 'played', 'backlog'];
      for (const [i, t] of names.entries()) { const g = { id: 'k' + i, title: t, year: 2015 + (i % 9), platforms: 'PC, PlayStation, Xbox', cover: `https://media.rawg.io/c${i % 8}.png`, status: st[i % 3], rating: i % 4 === 3 ? null : 6 + (i % 5), hours: i % 3 ? 10 + i * 3 : null, favorite: i % 2 === 0, favRank: i, notes: '', added: 1, updated: 100 - i }; await DB.put(g); games.push(g); }
      render(); });
    const rail = w >= 900, overflow = async () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    const tab = n => page.locator('#tabs button', { hasText: n });
    // Inicio
    ok(`${name}: Inicio sin scroll horizontal`, !(await overflow()));
    const nav = await page.locator('#tabs').boundingBox();
    if (rail) ok(`${name}: barra lateral (x=0, ancho 96, alto completo)`, nav.x === 0 && Math.round(nav.width) === 96 && nav.height >= h - 2, JSON.stringify(nav));
    else ok(`${name}: barra inferior`, Math.round(nav.y + nav.height) === h && nav.width === w, JSON.stringify(nav));
    const tile = await page.locator('#home .tile').first().boundingBox();
    ok(`${name}: tarjeta de carrusel ${Math.round(tile.width)}x${Math.round(tile.height)}`, w < 700 ? Math.round(tile.width) === 120 : tile.width >= 170);
    const hdr = await page.locator('header').boundingBox();
    ok(`${name}: cabecera empieza tras la barra lateral`, rail ? Math.round(hdr.x) === 96 : hdr.x === 0, hdr.x);
    await page.screenshot({ path: `tab-${name}-home.png` });
    // Lista
    await tab('Jugados').click();
    const cols = await page.locator('#list').evaluate(e => getComputedStyle(e).display === 'grid' ? getComputedStyle(e).gridTemplateColumns.split(' ').length : 1);
    const expCols = w < 700 ? 1 : w >= 1300 ? 3 : 2;
    ok(`${name}: lista en ${cols} columna(s)`, cols === expCols, `esperado ${expCols}`);
    ok(`${name}: lista sin scroll horizontal`, !(await overflow()));
    const card = await page.locator('#list .card').first().boundingBox();
    ok(`${name}: tarjeta de lista ${Math.round(card.width)}x${Math.round(card.height)} (≤ 560 de ancho en tablet)`, w < 700 || card.width <= 560, card.width);
    await page.screenshot({ path: `tab-${name}-list.png` });
    // Cuadrícula
    await page.click('#vt [data-v=grid]');
    const gcols = await page.locator('#list').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    const gt = await page.locator('#list .tile').first().boundingBox();
    ok(`${name}: cuadrícula ${gcols} columnas (${Math.round(gt.width)}px)`, w < 700 ? gcols === 3 : (gt.width >= 150 && gt.width <= 230 && gcols >= 4), `${gcols} cols ${gt.width}px`);
    ok(`${name}: cuadrícula sin scroll horizontal`, !(await overflow()));
    await page.screenshot({ path: `tab-${name}-grid.png` });
    // FAB y barra: no se pisan
    const fab = await page.locator('#fab').boundingBox();
    ok(`${name}: botón + dentro de pantalla y fuera de la barra`, fab.x + fab.width <= w && fab.y + fab.height <= h && (rail ? fab.x >= 96 : fab.y + fab.height <= nav.y), JSON.stringify(fab));
    // Ficha
    await page.locator('#list .tile').first().click(); await page.waitForSelector('#dlgEdit[open]');
    const dlg = await page.locator('#dlgEdit').boundingBox();
    ok(`${name}: ficha dentro de pantalla (${Math.round(dlg.width)}px)`, dlg.x >= 0 && dlg.x + dlg.width <= w + 1 && dlg.height <= h, JSON.stringify(dlg));
    await page.screenshot({ path: `tab-${name}-edit.png` });
    await page.click('#dlgEdit [data-close]');
    // Ajustes
    await page.click('#btnSettings'); await page.waitForSelector('#dlgSet[open]');
    await page.screenshot({ path: `tab-${name}-set.png` }); await page.click('#dlgSet [data-close]');
    // Arrastrar en Favoritos (lista, varias columnas)
    await tab('Favoritos').click(); await page.click('#vt [data-v=list]'); await page.selectOption('#sort', 'custom');
    const ids = async () => page.locator('#list .card').evaluateAll(es => es.map(e => e.dataset.id).join(','));
    const before = (await ids()).split(',');
    const a = await page.locator('#list .card').nth(0).boundingBox(), c = await page.locator('#list .card').nth(3).boundingBox();
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', a.x + a.width / 2, a.y + a.height / 2); await page.waitForTimeout(480);
    for (let i = 1; i <= 14; i++) { await touch('touchMove', a.x + a.width / 2 + (c.x - a.x) * i / 14, a.y + a.height / 2 + (c.y - a.y) * i / 14); await page.waitForTimeout(16); }
    await touch('touchEnd'); await page.waitForTimeout(250);
    const after = (await ids()).split(',');
    ok(`${name}: arrastrar con el dedo reordena (${before[0]} → posición 4)`, after.indexOf(before[0]) === 3 && after.length === before.length, after.join());
    ok(`${name}: sin errores`, errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' fallos de ' + out.length);
  await b.close(); srv.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
