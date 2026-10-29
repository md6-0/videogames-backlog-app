const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': {'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8115);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
const seed = page => page.evaluate(async () => { const mk = (id, t, o) => ({ id, title: t, year: 2020, platforms: '', cover: '', status: 'played', rating: null, hours: null, favorite: false, added: 1, updated: 1, ...o });
  const a = [mk('1','Hades',{playedY:2026,playedM:3}), mk('2','Celeste',{playedY:2025,playedM:5}), mk('3','Tunic',{playedY:2016,playedM:1}), mk('4','Futuro',{playedY:2027,playedM:1})]; await DB.replaceAll(a); games = a; render(); });
(async () => { try {
  const b = await chromium.launch();
  for (const [when, cardExpected, years] of [['2026-10-29T12:00:00', false, '2025,2016'], ['2026-11-30T23:59:00', false, '2025,2016'], ['2026-12-01T00:00:00', true, '2026,2025,2016'], ['2027-01-15T12:00:00', false, '2026,2025,2016']]) {
    const ctx = await b.newContext({ ...devices['Pixel 7'] }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.clock.setFixedTime(new Date(when)); await page.goto('http://localhost:8115/'); await page.waitForSelector('#tabs button'); await seed(page);
    ok(when + ': tarjeta en Inicio ' + (cardExpected ? 'sí' : 'no'), (await page.locator('.rw-card').count()) === (cardExpected ? 1 : 0));
    ok(when + ': botón de cabecera visible', await page.locator('#btnRew').isVisible());
    await page.click('#btnRew'); await page.waitForSelector('#dlgRew[open]'); await page.waitForTimeout(300);
    const opts = await page.$$eval('#rwYear option', o => o.map(x => x.value)); ok(when + ': años ' + years, opts.join() === years, opts.join());
    ok(when + ': abre en el más reciente', (await page.inputValue('#rwYear')) === years.split(',')[0]);
    await page.click('#dlgRew [data-close]'); await page.waitForTimeout(300);
    await page.click('#tabs button:has-text("Backlog")'); ok(when + ': botón también en otras pantallas', await page.locator('#btnRew').isVisible());
    ok(when + ': sin errores', errs.length === 0, errs.join('|')); await ctx.close();
  }
  const ctx = await b.newContext({ ...devices['Pixel 7'] }); const page = await ctx.newPage(); await page.clock.setFixedTime(new Date('2026-10-29T12:00:00')); await page.goto('http://localhost:8115/'); await page.waitForSelector('#tabs button');
  await page.evaluate(async () => { const a = [{ id: 'x', title: 'Solo 2026', year: 2020, platforms: '', cover: '', status: 'played', favorite: false, added: 1, updated: 1, playedY: 2026 }]; await DB.replaceAll(a); games = a; render(); });
  ok('sin años disponibles: botón oculto y sin tarjeta', !(await page.locator('#btnRew').isVisible()) && (await page.locator('.rw-card').count()) === 0);
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length); await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 500)); process.exit(1); } })();
