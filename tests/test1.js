const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
}).listen(8099);

const results = []; const ok = (n, c, extra = '') => { results.push([c ? 'OK ' : 'FAIL', n, extra]); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => { errs.push('DIÁLOGO NATIVO: ' + d.type() + ' ' + d.message()); d.dismiss(); }); await page.addInitScript(() => setInterval(() => { const d = document.getElementById('dlgAsk'); if (d && d.open) document.getElementById('askYes').click(); }, 40));

  // mock RAWG
  await ctx.route('https://api.rawg.io/**', route => {
    const u = new URL(route.request().url());
    if (u.searchParams.get('key') === 'BAD') return route.fulfill({ status: 401, body: '{}' });
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ results: [
        { id: 1, name: 'Hollow Knight', released: '2017-02-24', background_image: 'https://media.rawg.io/x.jpg', parent_platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'Nintendo' } }] },
        { id: 2, name: 'Hades', released: '2020-09-17', background_image: null, parent_platforms: [{ platform: { name: 'PC' } }] }] }) });
  });
  await ctx.route('https://media.rawg.io/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(ROOT + '/icon-192.png') }));

  await page.goto('http://localhost:8099/');
  await page.waitForSelector('#tabs button');
  ok('carga y pestañas', (await page.locator('#tabs button').count()) === 5);
  ok('estado vacío', (await page.locator('.empty').count()) === 1);

  // sin clave
  await page.click('#fab');
  ok('aviso sin clave', await page.locator('#noKey').isVisible());
  ok('búsqueda deshabilitada sin clave', await page.locator('#sq').isDisabled());
  await page.click('#goKey');
  await page.fill('#apiKey', 'TESTKEY'); await page.click('#saveKey');
  await page.click('#dlgSet [data-close]');

  // buscar y añadir (desde la página Jugando)
  await page.locator('#tabs button', { hasText: 'Jugando' }).click();
  await page.click('#fab');
  ok('sin aviso con clave', !(await page.locator('#noKey').isVisible()));
  await page.fill('#sq', 'hollow'); await page.press('#sq', 'Enter');
  await page.waitForSelector('.res');
  ok('resultados de búsqueda', (await page.locator('.res').count()) === 2);
  await page.locator('.res').first().click();
  await page.waitForSelector('#dlgEdit[open]');
  ok('título precargado', (await page.inputValue('#eTitle')) === 'Hollow Knight');
  ok('año precargado', (await page.inputValue('#eYear')) === '2017');
  ok('estado por defecto = pestaña actual (Jugando)', (await page.locator('#eStatus [aria-pressed=true]').innerText()) === 'Jugando');
  // pasar a Jugados, nota 9.5, favorito
  await page.locator('#eStatus button', { hasText: 'Jugados' }).click();
  await page.locator('#eRange').fill('9.5');
  ok('muestra la nota', (await page.innerText('#eBig')) === '9.5');
  await page.click('#eFav');
  await page.click('#eSave');
  await page.waitForTimeout(200);
  ok('salta a pestaña Jugados', (await page.locator('#tabs [aria-selected=true]').innerText()).startsWith('Jugados'));
  ok('tarjeta con nota 9.5', (await page.locator('.card .chip').first().innerText()) === '9.5');
  ok('tarjeta con corazón', await page.locator('.card .heart.on').count() === 1);
  ok('portada aplicada', (await page.locator('.card').first().evaluate(e => e.style.backgroundImage)).includes('media.rawg.io'));

  // nota 0 válida
  await page.locator('.card').first().click();
  await page.locator('#eRange').fill('0');
  ok('nota 0 distinta de sin nota', (await page.innerText('#eBig')) === '0');
  await page.click('#eSave'); await page.waitForTimeout(150);
  ok('guarda 0', (await page.locator('.card .chip').first().innerText()) === '0');
  await page.locator('.card').first().click();
  await page.click('#eClear'); ok('quitar nota', (await page.innerText('#eBig')) === '—');
  await page.click('#eSave'); await page.waitForTimeout(150);
  ok('sin nota: no hay etiqueta', (await page.locator('.card .chip').count()) === 0);

  // añadir a mano al backlog
  await page.locator('#tabs button', { hasText: 'Backlog' }).click();
  await page.click('#fab'); await page.fill('#sq', 'Mi juego <b>x</b>'); await page.click('#manual');
  await page.waitForSelector('#dlgEdit[open]');
  ok('manual precarga título', (await page.inputValue('#eTitle')) === 'Mi juego <b>x</b>');
  ok('estado = Backlog', (await page.locator('#eStatus [aria-pressed=true]').innerText()) === 'Backlog');
  await page.click('#eSave'); await page.waitForTimeout(150);
  ok('HTML en título se muestra como texto', (await page.locator('.card .title').first().innerText()) === 'Mi juego <b>x</b>' && (await page.locator('.card .title b').count()) === 0);
  // guardar sin título
  await page.click('#fab'); await page.click('#manual'); await page.waitForSelector('#dlgEdit[open]');
  await page.click('#eSave'); await page.waitForTimeout(100);
  ok('rechaza título vacío', await page.locator('#dlgEdit[open]').count() === 1);
  await page.click('#eDel'); await page.waitForTimeout(150);

  // favoritos
  await page.locator('#tabs button', { hasText: 'Favoritos' }).click();
  ok('favoritos lista 1', (await page.locator('.card').count()) === 1);

  // filtro y orden
  await page.locator('#tabs button', { hasText: 'Backlog' }).click();
  await page.fill('#q', 'zzz'); ok('filtro sin resultados', (await page.locator('#list .empty').innerText()).includes('Sin resultados'));
  await page.fill('#q', '');

  // persistencia tras recarga
  await page.reload(); await page.waitForSelector('#tabs button');
  await page.locator('#tabs button', { hasText: 'Jugados' }).click();
  ok('persiste tras recargar', (await page.locator('.card').count()) === 1);


  // horas
  await page.locator('.card').first().click();
  await page.fill('#eHours', '12,5');
  await page.click('#eSave'); await page.waitForTimeout(150);
  ok('horas en la tarjeta', (await page.locator('.card .sub').first().innerText()).includes('12,5 h'));
  await page.locator('.card').first().click();
  ok('horas se recargan en el formulario', (await page.inputValue('#eHours')) === '12.5');
  await page.fill('#eHours', 'abc'); await page.click('#eSave'); await page.waitForTimeout(120);
  ok('rechaza texto en horas', await page.locator('#dlgEdit[open]').count() === 1);
  await page.fill('#eHours', '-3'); await page.click('#eSave'); await page.waitForTimeout(120);
  ok('rechaza horas negativas', await page.locator('#dlgEdit[open]').count() === 1);
  await page.fill('#eHours', ''); await page.click('#eSave'); await page.waitForTimeout(150);
  ok('borrar horas las deja sin registrar', !(await page.locator('.card .sub').first().innerText()).includes(' h'));
  await page.locator('.card').first().click(); await page.fill('#eHours', '40'); await page.click('#eSave'); await page.waitForTimeout(150);
  await page.evaluate(() => { setSort(tab, 'hours'); render(); }); ok('orden por horas no rompe', (await page.locator('.card').count()) === 1);
  await page.evaluate(() => { setSort(tab, 'recent'); render(); });
  // exportar
  await page.click('#btnSettings');
  const stats = await page.innerText('#stats');
  ok('estadísticas con horas', stats.includes('Horas totales') && stats.includes('40'));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exp')]);
  const file = require('path').join(require('os').tmpdir(), 'biblioteca-tests-export.json');
  await dl.saveAs(file);
  const exp = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok('export válido', exp.games.length === 2 && exp.app === 'biblioteca' && exp.games.some(g => g.hours === 40));

  // importar: borrar uno, luego importar
  await page.click('#dlgSet [data-close]');
  await page.locator('.card').first().click(); await page.click('#eDel'); await page.waitForTimeout(150);
  ok('borrado', (await page.locator('.card').count()) === 0 || (await page.locator('.empty').count()) === 1);
  await page.click('#btnSettings');
  await page.setInputFiles('#file', file); await page.waitForTimeout(300);
  await page.locator('#tabs button', { hasText: 'Jugados' }).click();
  ok('importar restaura', (await page.locator('.card').count()) === 1);
  // import corrupto
  fs.writeFileSync(require('path').join(require('os').tmpdir(), 'biblioteca-tests-bad.json'), '{nope');
  await page.click('#btnSettings');
  await page.setInputFiles('#file', require('path').join(require('os').tmpdir(), 'biblioteca-tests-bad.json')); await page.waitForTimeout(200);
  ok('import inválido avisa', (await page.locator('.toast .tm').last().innerText()) === 'Archivo no válido');
  ok('import inválido no destruye', (await page.evaluate(() => games.length)) === 2);
  await page.click('#dlgSet [data-close]');

  // clave mala
  await page.click('#btnSettings'); await page.fill('#apiKey', 'BAD'); await page.click('#saveKey'); await page.click('#dlgSet [data-close]');
  await page.click('#fab'); await page.fill('#sq', 'zelda'); await page.press('#sq', 'Enter'); await page.waitForTimeout(700);
  ok('clave inválida muestra error', (await page.locator('#results').innerText()).includes('Clave no válida'));
  await page.click('#dlgAdd [data-close]');

  // sin red
  await page.click('#btnSettings'); await page.fill('#apiKey', 'TESTKEY'); await page.click('#saveKey'); await page.click('#dlgSet [data-close]');
  await ctx.route('https://api.rawg.io/**', r => r.abort());
  await page.click('#fab'); await page.fill('#sq', 'mario'); await page.press('#sq', 'Enter'); await page.waitForTimeout(700);
  ok('sin red: mensaje', (await page.locator('#results').innerText()).includes('No se pudo conectar'));
  await page.click('#dlgAdd [data-close]');

  // offline: service worker
  await page.waitForTimeout(500);
  const sw = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
  ok('service worker registrado', sw);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForTimeout(300);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('#tabs button');
  ok('abre sin conexión', (await page.locator('#tabs button').count()) === 5);
  await ctx.setOffline(false);

  // overflow horizontal
  const ov = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  ok('sin scroll horizontal', !ov);

  await page.locator('#tabs button', { hasText: 'Jugados' }).click();
  await page.screenshot({ path: require('path').join(require('os').tmpdir(), 'biblioteca-tests-shot-list.png') });
  await page.locator('.card').first().click();
  await page.screenshot({ path: require('path').join(require('os').tmpdir(), 'biblioteca-tests-shot-edit.png') });

  ok('sin errores de consola/página', errors.filter(e => !e.includes('net::ERR_FAILED') && !e.includes('Failed to load resource')).length === 0, errors.join(' | '));
  for (const r of results) console.log(r.join(' | '));
  console.log(results.filter(r => r[0] === 'FAIL').length + ' fallos de ' + results.length);
  await browser.close(); srv.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
