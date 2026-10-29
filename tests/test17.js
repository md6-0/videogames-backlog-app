const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': {'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8099);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await ctx.route('https://otraweb.example/**', r => r.abort('failed'));
  await page.goto('http://localhost:8099/'); await page.waitForSelector('#tabs button');
  await page.evaluate(async () => { for (const [i, c] of [[0, 'https://otraweb.example/a.png'], [1, '']]) { const g = { id: 'k' + i, title: 'Juego ' + i, year: 2019, platforms: '', cover: c, status: 'backlog', rating: null, hours: null, favorite: false, notes: '', added: 1, updated: 10 - i }; await DB.put(g); games.push(g); } render(); });
  await page.click('#tabs button:has-text("Backlog")');
  // exportar con portada externa que falla → lista el título
  await page.click('#btnImg'); await page.waitForFunction(() => /imagen/.test(document.querySelector('#imgNote').textContent), null, { timeout: 30000 });
  let note = await page.innerText('#imgNote'); ok('la exportación nombra el juego sin portada', /Sin portada en la imagen.*Juego 0/.test(note) && !/Juego 1\b/.test(note.split('Sin portada')[1] || ''), note);
  await page.click('#dlgImg [data-close]');
  // subir imagen a Juego 0
  await page.click('#list .card:has-text("Juego 0")'); await page.waitForSelector('#dlgEdit[open]');
  await page.setInputFiles('#eCoverFile', require('path').join(__dirname, 'fixtures', 'c3.png')); await page.waitForTimeout(400);
  ok('tras subir, el campo URL queda vacío y con aviso', (await page.inputValue('#eCoverUrl')) === '' && /dispositivo/.test(await page.getAttribute('#eCoverUrl', 'placeholder')));
  ok('la vista previa usa la imagen', /data:image\/jpeg/.test(await page.locator('#eCover').evaluate(e => e.style.backgroundImage)));
  await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open); await page.waitForTimeout(200);
  let g = await page.evaluate(() => DB.all().then(a => a.find(x => x.id === 'k0')));
  ok('guardada como data:image/jpeg razonable (<300 KB)', /^data:image\/jpeg;base64,/.test(g.cover) && g.cover.length < 300000, String(g.cover.length));
  // sube también a Juego 1 (sin portada)
  await page.click('#list .card:has-text("Juego 1")'); await page.waitForSelector('#dlgEdit[open]'); await page.setInputFiles('#eCoverFile', require('path').join(__dirname, 'fixtures', 'c5.png')); await page.waitForTimeout(400); await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open);
  // exportar: ahora sin avisos
  await page.click('#btnImg'); await page.waitForFunction(() => /imagen/.test(document.querySelector('#imgNote').textContent), null, { timeout: 30000 });
  note = await page.innerText('#imgNote'); ok('exportar: sin portadas perdidas', !/Sin portada/.test(note), note);
  const px = await page.evaluate(async () => { const bm = await createImageBitmap(IMG.blobs[0]); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return Array.from(x.getImageData(110, 230, 1, 1).data); });
  ok('la imagen exportada tiene color de portada (no el gris de la inicial)', !(px[0] === 42 && px[1] === 71 && px[2] === 94), JSON.stringify(px));
  await page.click('#dlgImg [data-close]');
  // sobrevive a recargar y a exportar/importar
  await page.reload(); await page.waitForSelector('#tabs button');
  g = await page.evaluate(() => DB.all().then(a => a.find(x => x.id === 'k0'))); ok('persiste tras recargar', /^data:image\/jpeg/.test(g.cover));
  const exp = await page.evaluate(() => JSON.stringify({ games })); fs.writeFileSync('imp17.json', exp);
  await page.click('#btnSettings'); await page.setInputFiles('#file', 'imp17.json'); await page.waitForSelector('#dlgAsk[open]'); await page.click('#askYes'); await page.waitForTimeout(400);
  g = await page.evaluate(() => DB.all().then(a => a.find(x => x.id === 'k0'))); ok('importar conserva la imagen subida', /^data:image\/jpeg/.test(g.cover));
  // seguridad: data: no imagen se rechaza
  ok('data: no válido rechazado', await page.evaluate(() => safeUrl('data:text/html;base64,PHNjcmlwdD4=') === '' && safeUrl('javascript:alert(1)') === '' && safeUrl('data:image/svg+xml;base64,AAAA') === ''));
  // quitar
  await page.click('#tabs button:has-text("Backlog")'); await page.click('#list .card:has-text("Juego 0")'); await page.waitForSelector('#dlgEdit[open]');
  ok('reabrir: el campo URL no muestra el data:', (await page.inputValue('#eCoverUrl')) === '');
  await page.click('#eCoverBox summary'); await page.waitForTimeout(150); await page.click('#eCoverClear'); await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open); await page.waitForTimeout(200);
  g = await page.evaluate(() => DB.all().then(a => a.find(x => x.id === 'k0'))); ok('quitar portada la vacía', g.cover === '', g.cover.slice(0, 40));
  ok('sin errores', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length); await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 400)); process.exit(1); } })();
