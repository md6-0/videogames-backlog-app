// La app arranca sin conexión con todos sus archivos (css/ y js/) desde la caché del service worker.
const SWV = require('fs').readFileSync(require('path').join(__dirname, '..', 'sw.js'),'utf8').match(/VERSION = "([^"]+)"/)[1];
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const MIME = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': MIME[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8133);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch(); const ctx = await b.newContext(); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8133/'); await page.waitForSelector('#tabs button'); await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(800);
  const cached = await page.evaluate(async v => { const c = await caches.open('biblioteca-'+v); return (await c.keys()).map(r => new URL(r.url).pathname); }, SWV);
  ok('la caché contiene css y js', cached.includes('/css/app.css') && cached.includes('/js/main.js') && cached.includes('/js/rawg-image.js'), cached.join(','));
  srv.close(); await ctx.setOffline(true); await page.reload(); await page.waitForSelector('#tabs button', { timeout: 10000 });
  ok('sin conexión: arranca y pinta', (await page.locator('#tabs button').count()) === 5);
  ok('sin conexión: estilos aplicados', await page.evaluate(() => getComputedStyle(document.querySelector('.fab')).position === 'fixed'));
  ok('sin errores', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length); await b.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 500)); process.exit(1); } })();
