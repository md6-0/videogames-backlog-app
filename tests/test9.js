const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const m = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  res.writeHead(200, { 'Content-Type': m[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }).listen(8089);
var errs = []; const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await ctx.route('https://api.rawg.io/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [{ id: 7, name: 'Hades', released: '2020-09-17', background_image: null, parent_platforms: [{ platform: { name: 'PC' } }, { platform: { name: 'PlayStation' } }, { platform: { name: 'Nintendo' } }] }] }) }));
  await page.goto('http://localhost:8089/'); await page.waitForSelector('#tabs button');
  ok('viewport sin zoom', /user-scalable=no/.test(await page.getAttribute('meta[name=viewport]', 'content')) && /maximum-scale=1/.test(await page.getAttribute('meta[name=viewport]', 'content')));
  ok('touch-action sin pinch', (await page.evaluate(() => getComputedStyle(document.body).touchAction)) === 'pan-x pan-y');
  ok('gesturestart cancelado', await page.evaluate(() => { const e = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(e); return e.defaultPrevented; }));
  ok('sin ayudas en Inicio', (await page.locator('.hint').count()) === 0);
  await page.evaluate(() => store.set('rawgKey', 'x'));
  // añadir con RAWG
  await page.click('#fab'); await page.fill('#sq', 'Hades'); await page.press('#sq', 'Enter'); await page.waitForSelector('.res'); await page.click('.res');
  await page.waitForSelector('#dlgEdit[open]');
  const chips = async () => await page.locator('#ePlats button').evaluateAll(e => e.map(x => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(','));
  ok('ofrece las plataformas de RAWG, ninguna marcada', (await chips()) === 'PC,PlayStation,Nintendo', await chips());
  await page.click('#ePlats button:has-text("PC")'); await page.click('#ePlats button:has-text("Nintendo")');
  ok('marcar dos', (await chips()) === 'PC*,PlayStation,Nintendo*', await chips());
  await page.click('#ePlats button:has-text("PC")');
  ok('desmarcar', (await chips()) === 'PC,PlayStation,Nintendo*', await chips());
  ok('el diálogo sigue abierto tras Enter', (await page.locator('#dlgEdit[open]').count()) === 1);
  console.log(out.join('\n')); await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open); await page.waitForTimeout(150);
  let g = await page.evaluate(() => games.find(x => x.title === 'Hades'));
  ok('guardado: platforms = "Nintendo"', g.platforms === 'Nintendo', g.platforms);
  ok('guardado: no queda "plats" ni se pierde avail', g.plats === undefined && g.avail.length === 3, JSON.stringify(g));
  // reabrir: conserva selección
  await page.evaluate(id => openEdit(id), g.id);
  ok('reabrir conserva selección', (await chips()) === 'PC,PlayStation,Nintendo*', await chips());
  await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open); await page.waitForTimeout(150);
  // añadir a mano: lista base
  await page.click('#fab'); await page.fill('#sq', 'Mi juego'); await page.click('#manual'); await page.waitForSelector('#dlgEdit[open]');
  ok('a mano: lista base sin marcar', (await chips()) === 'PC,PlayStation,Xbox,Nintendo,iOS,Android,Mac,Linux,Web', await chips());
  await page.click('#ePlats button:has-text("Xbox")'); await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open); await page.waitForTimeout(150);
  g = await page.evaluate(() => games.find(x => x.title === 'Mi juego'));
  ok('a mano: guardado "Xbox"', g.platforms === 'Xbox', g.platforms);
  // juego antiguo con texto libre
  await page.evaluate(async () => { const o = { id: 'old', title: 'Viejo', year: 2000, platforms: 'PC, Dreamcast', cover: '', status: 'played', rating: null, hours: null, favorite: false, notes: '', added: 1, updated: 1 }; await DB.put(o); games.push(o); openEdit('old'); });
  ok('juego antiguo: conserva sus plataformas marcadas', (await chips()).includes('PC*') && (await chips()).includes('Dreamcast*'), await chips());
  await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open); await page.waitForTimeout(150);
  // lista muestra plataformas
  await page.click('#tabs button:has-text("Jugados")');
  ok('la lista muestra "PC, Dreamcast"', (await page.locator('#list').innerText()).includes('PC, Dreamcast'));
  // exportar/importar conserva avail
  ok('sin errores', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length);
  await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0,300)); process.exit(1); } })();
