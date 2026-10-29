const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': {'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8095);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8095/'); await page.waitForSelector('#tabs button');
  const visible = () => page.evaluate(() => { const t = document.querySelector('.toast'); if (!t) return 'sin toast'; const r = t.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return (t.contains(e) || t.matches(':popover-open')) ? 'visible' : 'tapado por ' + (e && (e.id || e.className || e.tagName)); });
  await page.evaluate(() => toast('Hola sin diálogo')); ok('sin diálogo: visible', (await visible()) === 'visible', await visible());
  await page.waitForTimeout(2600);
  for (const [n, js] of [['ajustes', () => openSettings()], ['añadir', () => openAdd()]]) {
    await page.evaluate(js); await page.waitForTimeout(150);
    await page.evaluate(() => toast('Clave guardada')); ok(`con diálogo ${n}: visible`, (await visible()) === 'visible', await visible());
    await page.screenshot({ path: `toast-${n}.png` });
    await page.waitForTimeout(2600); ok(`${n}: el aviso desaparece`, (await page.locator('.toast').count()) === 0);
    await page.evaluate(() => document.querySelector('dialog[open]').close());
  }
  ok('sin errores', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); await b.close(); srv.close(); })();
