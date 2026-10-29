const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': {'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8109);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 1200 } }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await ctx.route('https://api.rawg.io/**', r => { const q = new URL(r.request().url()).searchParams.get('search'); const res = q === 'hades' ? [{ id: 7, name: 'Hades', released: '2020-09-17', background_image: null, parent_platforms: [] }, { id: 8, name: 'Hades', released: '1999-01-01', background_image: null, parent_platforms: [] }] : [{ id: 99, name: 'Celeste', released: '2018-01-25', background_image: null, parent_platforms: [] }]; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: res }) }); });
  await page.goto('http://localhost:8109/'); await page.waitForSelector('#tabs button'); await page.evaluate(() => store.set('rawgKey', 'x'));
  const seed = () => page.evaluate(async () => { await DB.replaceAll([]); games = []; const g = { id: 'h', title: 'Hades', year: 2020, platforms: '', cover: '', rawgId: 7, status: 'backlog', rating: null, hours: null, favorite: false, notes: '', added: 1, updated: 1 }; await DB.put(g); games.push(g); render(); });
  const count = () => page.evaluate(() => DB.all().then(a => a.length));
  const ex = id => page.evaluate(i => DB.all().then(a => a.find(x => x.id === i)), id);
  const addRawg = async (q, idx = 0) => { await page.click('#fab'); await page.fill('#sq', q); await page.press('#sq', 'Enter'); await page.waitForSelector('#results .res'); await page.locator('#results .res').nth(idx).click(); await page.waitForTimeout(350); };
  const askOpen = async () => (await page.locator('#dlgAsk[open]').count()) === 1;
  const closeAll = async () => { await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close())); await page.waitForTimeout(300); };
  await seed();
  // 1) misma categoría
  await page.click('#tabs button:has-text("Backlog")'); await addRawg('hades', 0);
  ok('misma categoría: avisa', (await askOpen()) && (await page.innerText('#askText')) === '"Hades" ya está en Backlog.' && (await page.innerText('#askYes')) === 'Ver el que tengo', await page.innerText('#askText'));
  await page.click('#askYes'); await page.waitForSelector('#dlgEdit[open]');
  ok('"Ver el que tengo" abre la ficha del existente y no crea nada', (await page.inputValue('#eTitle')) === 'Hades' && (await count()) === 1);
  await closeAll();
  await addRawg('hades', 0); ok('no existe la opción de añadir duplicado', (await page.locator('#askAlt').isVisible()) === false); await page.click('#askNo'); await page.waitForTimeout(300); ok('cancelar no crea nada', (await count()) === 1); await closeAll();
  await seed(); await addRawg('hades', 0); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok('Escape cancela: no crea ni abre la ficha', (await count()) === 1 && (await page.locator('#dlgEdit[open]').count()) === 0); await closeAll();
  // 2) mismo título pero otro rawgId → no es duplicado
  await seed(); await addRawg('hades', 1); ok('mismo título con otro rawgId (otro juego): sin aviso, se crea', !(await askOpen()) && (await count()) === 2 && (await page.locator('#dlgEdit[open]').count()) === 1); await closeAll();
  // 3) otra categoría: mover
  await seed(); await page.click('#tabs button:has-text("Jugando")'); await addRawg('hades', 0);
  ok('otra categoría: avisa de dónde está y ofrece moverlo', (await askOpen()) && (await page.innerText('#askText')) === '"Hades" ya está en Backlog.' && (await page.innerText('#askYes')) === 'Moverlo a Jugando', await page.innerText('#askText'));
  await page.click('#askYes'); await page.waitForTimeout(350);
  let h = await ex('h'); ok('se mueve a Jugando, sin crear otro y sin ficha', h.status === 'playing' && (await count()) === 1 && (await page.locator('dialog[open]').count()) === 0, JSON.stringify(h));
  ok('aviso de éxito "Movido a Jugando"', (await page.locator('.toast.t-success .tm').last().innerText()) === 'Movido a Jugando');
  // 4) mover a Jugados rellena fecha
  await page.click('#tabs button:has-text("Jugados")'); await addRawg('hades', 0); await page.click('#askYes'); await page.waitForTimeout(350);
  h = await ex('h'); const y = new Date().getFullYear(); ok('a Jugados: estado, finished y mes/año actuales', h.status === 'played' && !!h.finished && h.playedY === y, JSON.stringify(h));
  // 5) Favoritos
  await page.click('#tabs button:has-text("Favoritos")'); await addRawg('hades', 0);
  ok('en Favoritos: ofrece añadir a favoritos', (await askOpen()) && (await page.innerText('#askYes')) === 'Añadir a Favoritos' && (await page.innerText('#askText')) === '"Hades" ya está en Jugados.', await page.innerText('#askText'));
  await page.click('#askYes'); await page.waitForTimeout(350); h = await ex('h'); ok('queda favorito sin cambiar de estado', h.favorite === true && h.status === 'played' && (await count()) === 1);
  await addRawg('hades', 0); ok('ya favorito: "ya está en Favoritos"', (await askOpen()) && (await page.innerText('#askText')) === '"Hades" ya está en Favoritos.'); await page.click('#askNo'); await closeAll();
  // 6) manual: título con otras mayúsculas / tildes
  await seed(); await page.click('#tabs button:has-text("Backlog")'); await page.click('#fab'); await page.fill('#sq', 'HÁDES!'); await page.click('#manual'); await page.waitForTimeout(350);
  ok('alta manual con otro formato del mismo título: avisa', await askOpen()); await page.click('#askNo'); await closeAll();
  // 7) desde Inicio: la categoría de destino es Backlog
  await seed(); await page.click('#tabs button:has-text("Inicio")'); await addRawg('hades', 0);
  ok('desde Inicio cuenta como Backlog', (await askOpen()) && (await page.innerText('#askText')) === '"Hades" ya está en Backlog.' && (await page.innerText('#askYes')) === 'Ver el que tengo'); await page.click('#askNo'); await closeAll();
  // 8) juego distinto: sin aviso
  await page.click('#tabs button:has-text("Backlog")'); await addRawg('celeste', 0); ok('juego nuevo: sin aviso, se crea y abre la ficha', !(await askOpen()) && (await count()) === 2 && (await page.locator('#dlgEdit[open]').count()) === 1);
  ok('sin errores', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length); await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 500)); process.exit(1); } })();
