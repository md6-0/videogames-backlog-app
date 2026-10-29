// Efecto cromo: solo con ratón, sin movimiento reducido y sin arrastrar.
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const MIME = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': MIME[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8138);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
const seed = page => page.evaluate(async () => { const gs = Array.from({ length: 6 }, (_, i) => ({ id: 'g' + i, title: 'Juego ' + i, year: 2020, platforms: 'PC', cover: '', status: 'played', playedY: 2025, favorite: false, rating: 8, rank: i, added: Date.now(), updated: Date.now() })); await DB.replaceAll(gs); games = gs; render(); });
(async () => { try {
  const b = await chromium.launch();
  // escritorio con ratón
  let ctx = await b.newContext({ viewport: { width: 1500, height: 800 } }); let page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8138/'); await page.waitForSelector('#tabs button'); await seed(page);
  const tile = page.locator('.cat').nth(2).locator('.tile').first();
  await tile.hover({ position: { x: 150, y: 30 } }); await page.waitForTimeout(300);
  ok('al pasar el ratón la portada se activa', await tile.evaluate(e => e.classList.contains('foil')));
  const v = await tile.evaluate(e => ({ rx: parseFloat(e.style.getPropertyValue('--rx')), ry: parseFloat(e.style.getPropertyValue('--ry')), t: getComputedStyle(e).transform }));
  ok('se inclina hacia el puntero (arriba a la derecha)', v.ry > 0 && v.rx > 0 && v.t !== 'none', JSON.stringify(v));
  ok('tiene reflejo', await tile.evaluate(e => getComputedStyle(e, '::after').content !== 'none'));
  await page.mouse.move(1400, 20); await page.waitForTimeout(250);
  ok('al salir se desactiva y se limpian las variables', await tile.evaluate(e => !e.classList.contains('foil') && !e.style.getPropertyValue('--rx')));
  await tile.hover(); await page.waitForTimeout(200); await page.mouse.down(); await page.waitForTimeout(100);
  ok('al pulsar se desactiva', await tile.evaluate(e => !e.classList.contains('foil'))); await page.mouse.up(); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.click('#tabs button:has-text("Jugados")'); await page.waitForTimeout(250);
  const card = page.locator('#list .card').first(); await card.hover(); await page.waitForTimeout(250);
  ok('también en las tarjetas de lista', await card.evaluate(e => e.classList.contains('foil')));
  await page.evaluate(() => document.body.classList.add('dnd')); await page.mouse.move(700, 400); await page.waitForTimeout(100); await card.hover({ position: { x: 20, y: 20 } }); await page.waitForTimeout(150);
  ok('no se activa mientras se arrastra', await card.evaluate(e => !e.classList.contains('foil')));
  ok('sin errores de JS', !errs.length, errs.join('|')); await ctx.close();
  // movimiento reducido
  ctx = await b.newContext({ viewport: { width: 1500, height: 800 }, reducedMotion: 'reduce' }); page = await ctx.newPage();
  await page.goto('http://localhost:8138/'); await page.waitForSelector('#tabs button'); await seed(page);
  const t2 = page.locator('.cat').nth(2).locator('.tile').first(); await t2.hover(); await page.waitForTimeout(250);
  ok('con movimiento reducido no hay efecto', await t2.evaluate(e => !e.classList.contains('foil') && getComputedStyle(e).transform === 'none'));
  await ctx.close();
  // pantalla táctil
  ctx = await b.newContext({ ...devices['Pixel 7'] }); page = await ctx.newPage();
  await page.goto('http://localhost:8138/'); await page.waitForSelector('#tabs button'); await seed(page);
  const t3 = page.locator('.cat').nth(2).locator('.tile').first(); await t3.tap(); await page.waitForTimeout(300);
  ok('en el móvil no hay efecto', await t3.evaluate(e => !e.classList.contains('foil')));
} catch (e) { out.push('FAIL excepción ' + e.message); } console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length); srv.close(); process.exit(0); })();
