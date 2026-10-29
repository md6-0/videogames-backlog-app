const SWV = require('fs').readFileSync(require('path').join(__dirname, '..', 'sw.js'),'utf8').match(/VERSION = "([^"]+)"/)[1];
// Actualización real: un usuario con la v52 (un solo archivo) recibe la 1.0.0 (css/ y js/) y no pierde sus datos.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const MIME = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
let root = path.join(__dirname, 'fixtures', 'v52');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(root, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': MIME[path.extname(f)]||'application/octet-stream', 'Cache-Control': 'no-cache'}); res.end(fs.readFileSync(f)); }).listen(8134);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch(); const ctx = await b.newContext(); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8134/'); await page.waitForSelector('#tabs button'); await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForTimeout(600);
  await page.evaluate(async () => { const g = { id: 'x', title: 'Hades', year: 2020, platforms: 'PC', cover: '', status: 'played', rating: 9, hours: 40, favorite: true, added: 1, updated: 1, playedY: 2025, playedM: 3, notes: 'nota antigua' }; await DB.put(g); games = [g]; render(); });
  ok('v52 funcionando', (await page.evaluate(() => getVersion())) === 'v52');
  root = require('path').resolve(__dirname, '..');
  await page.evaluate(() => swReg.update()); await page.waitForSelector('#upd:not(.hidden)', { timeout: 15000 });
  ok('aparece el aviso de versión nueva', true);
  await Promise.all([page.waitForEvent('load', { timeout: 15000 }), page.click('#updGo')]);
  await page.waitForSelector('#tabs button'); await page.waitForTimeout(600);
  ok('tras actualizar: versión nueva', (await page.evaluate(() => getVersion())) === SWV);
  ok('carga los scripts nuevos', await page.evaluate(() => typeof createGame === 'function' && !!document.querySelector('link[href="css/app.css"]')));
  const g = await page.evaluate(() => DB.all().then(a => a[0]));
  ok('los datos siguen intactos (incluidas notas antiguas)', g && g.title === 'Hades' && g.rating === 9 && g.notes === 'nota antigua', JSON.stringify(g));
  ok('se ve el juego en Inicio', (await page.locator('#home .tile').count()) >= 1);
  const caches = await page.evaluate(() => caches.keys()); ok('la caché antigua se borra', !caches.includes('biblioteca-v52') && caches.includes('biblioteca-'+SWV), caches.join(','));
  ok('sin errores', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length); await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 500)); process.exit(1); } })();
