const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SRC = require('path').resolve(__dirname, '..'), SITE = require('path').join(require('os').tmpdir(), 'biblioteca-tests-site');
fs.rmSync(SITE, { recursive: true, force: true }); fs.mkdirSync(SITE);
fs.cpSync(SRC, SITE, { recursive: true });
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(SITE, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const m = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  res.writeHead(200, { 'Content-Type': m[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' }); res.end(fs.readFileSync(f)); }).listen(8090);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await page.goto('http://localhost:8090/'); await page.waitForSelector('#tabs button');
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const ver = () => page.evaluate(() => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = e => r(e.data); navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [ch.port2]); }));
  ok('primera instalación: sin aviso', await page.locator('#upd').isHidden());
  const v1 = await ver(); ok('SW informa su versión (' + v1 + ')', /^(v\d+|\d+\.\d+\.\d+)$/.test(v1));
  // datos de ejemplo para comprobar que sobreviven a la actualización
  await page.evaluate(async () => { const g = { id: 'u1', title: 'Persistente', year: 2020, platforms: 'PC', cover: '', status: 'playing', rating: 7, hours: 3, favorite: false, notes: '', added: 1, updated: 1 }; await DB.put(g); games.push(g); render(); });
  // ajustes: versión + buscar sin novedades
  await page.click('#btnSettings'); await page.waitForFunction(() => document.querySelector('#ver').textContent.startsWith('Versión'));
  ok('ajustes muestran la versión', (await page.innerText('#ver')) === 'Versión ' + v1);
  await page.click('#chk'); await page.waitForTimeout(600);
  ok('buscar sin novedades → "Ya tienes la última versión"', (await page.locator('.toast .tm').last().innerText()) === 'Ya tienes la última versión' && await page.locator('#upd').isHidden());
  await page.click('#dlgSet [data-close]');

  // --- publicar versión nueva
  let sw = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8').replace(/const VERSION = "[^"]+"/, 'const VERSION = "vTEST2"');
  fs.writeFileSync(path.join(SITE, 'sw.js'), sw);
  fs.writeFileSync(path.join(SITE, 'index.html'), fs.readFileSync(path.join(SITE, 'index.html'), 'utf8').replace('<title>Mi Biblioteca</title>', '<title>Mi Biblioteca NUEVA</title>'));
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  await page.waitForSelector('#upd:not(.hidden)', { timeout: 8000 });
  ok('aparece el aviso de versión nueva', await page.locator('#upd').isVisible());
  ok('la página sigue con la versión vieja hasta pulsar', (await page.title()) === 'Mi Biblioteca' && (await ver()) === v1);
  await page.waitForTimeout(500);
  ok('el aviso está arriba y ocupa todo el ancho', await page.evaluate(() => { const r = document.querySelector('#upd').getBoundingClientRect(); return r.top === 0 && Math.abs(r.width - innerWidth) < 1; }));
  await page.screenshot({ path: 'upd-banner.png' });
  // cerrar con ✕
  await page.click('#updX'); ok('✕ oculta el aviso', await page.locator('#upd').isHidden());
  // buscar manualmente lo vuelve a mostrar
  await page.click('#btnSettings'); await page.click('#chk'); await page.waitForSelector('#upd:not(.hidden)');
  ok('"Buscar actualizaciones" vuelve a mostrar el aviso', await page.locator('#upd').isVisible() && (await page.locator('#dlgSet[open]').count()) === 0);
  // con una ventana abierta no recarga
  await page.locator('#tabs button', { hasText: 'Jugando' }).click(); await page.locator('#list .card').first().click(); await page.waitForSelector('#dlgEdit[open]');
  await page.evaluate(() => document.querySelector('#upd').style.zIndex = 99999);
  await page.evaluate(() => document.querySelector('#updGo').click()); await page.waitForTimeout(400);
  ok('con una ventana abierta pide cerrarla y no recarga', (await page.locator('.toast .tm').last().innerText()).includes('ficha') && (await page.locator('#dlgEdit[open]').count()) === 1 && (await page.title()) === 'Mi Biblioteca');
  await page.click('#dlgEdit [data-close]');
  // actualizar
  await Promise.all([page.waitForEvent('load'), page.click('#updGo')]);
  await page.waitForSelector('#tabs button'); await page.waitForFunction(() => navigator.serviceWorker.controller);
  ok('tras pulsar Actualizar carga la versión nueva', (await page.title()) === 'Mi Biblioteca NUEVA');
  ok('el SW activo es el nuevo', (await ver()) === 'vTEST2', await ver());
  ok('sin aviso tras actualizar', await page.locator('#upd').isHidden());
  await page.locator('#tabs button', { hasText: 'Jugando' }).click();
  ok('los datos sobreviven a la actualización', (await page.locator('#list .card').count()) === 1 && (await page.locator('#list .card .title').innerText()) === 'Persistente');
  // cachés viejas eliminadas
  const keys = await page.evaluate(() => caches.keys()); ok('caché antigua eliminada', keys.length === 1 && keys[0].endsWith('vTEST2'), keys.join());
  // sin conexión sigue abriendo
  await ctx.setOffline(true); await page.reload(); await page.waitForSelector('#tabs button');
  ok('sigue funcionando sin conexión', (await page.title()) === 'Mi Biblioteca NUEVA'); await ctx.setOffline(false);
  ok('sin errores', errs.filter(e => !e.includes('ERR_INTERNET_DISCONNECTED') && !e.includes('Failed to load resource')).length === 0, errs.join('|'));
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' fallos de ' + out.length);
  await b.close(); srv.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
