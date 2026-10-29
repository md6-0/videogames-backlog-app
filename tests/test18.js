const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': {'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8101);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 1300 } }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await page.goto('http://localhost:8101/'); await page.waitForSelector('#tabs button');
  ok('pestañas: Inicio, Backlog, Jugando, Jugados, Favoritos', (await page.locator('#tabs button span').allInnerTexts()).join(',') === 'Inicio,Backlog,Jugando,Jugados,Favoritos');
  await page.evaluate(async () => { for (const [i, t] of ['A', 'B', 'C', 'D', 'E'].entries()) { const g = { id: 'k' + t, title: 'Juego ' + t, year: 2019, platforms: '', cover: '', status: 'played', rating: null, hours: null, favorite: false, notes: '', added: 1, updated: 100 - i, playedY: null, playedM: null }; await DB.put(g); games.push(g); } render(); });
  await page.click('#tabs button:has-text("Inicio")');
  ok('carruseles en orden Backlog, Jugando, Jugados, Favoritos', (await page.locator('.cat-t').allInnerTexts()).join(',') === 'Backlog,Jugando,Jugados,Favoritos');
  await page.click('#tabs button:has-text("Jugados")');
  const setDate = async (title, y, m) => { await page.click(`#list .card:has-text("${title}")`); await page.waitForSelector('#dlgEdit[open]'); await page.waitForTimeout(350);
    if (y) await page.selectOption('#ePlayedY', String(y)); if (m) await page.selectOption('#ePlayedM', String(m)); await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open); await page.waitForTimeout(200); };
  // mes deshabilitado sin año
  await page.click('#list .card:has-text("Juego A")'); await page.waitForSelector('#dlgEdit[open]'); await page.waitForTimeout(350);
  ok('sin año, el mes está deshabilitado', await page.locator('#ePlayedM').isDisabled());
  await page.selectOption('#ePlayedY', '2024'); ok('con año, el mes se habilita', await page.locator('#ePlayedM').isEnabled());
  ok('orden de estados en la ficha: Backlog, Jugando, Jugados', (await page.locator('#eStatus button').allInnerTexts()).join(',') === 'Backlog,Jugando,Jugados');
  await page.selectOption('#ePlayedM', '3'); await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open); await page.waitForTimeout(200);
  await setDate('Juego B', 2025, 11); await setDate('Juego C', 2023, 0); await setDate('Juego D', 2024, 9);
  const g = id => page.evaluate(i => DB.all().then(a => a.find(x => x.id === i)), id);
  let a = await g('kA'); ok('A: 2024-03', a.playedY === 2024 && a.playedM === 3, JSON.stringify(a));
  let c = await g('kC'); ok('C: solo año 2023 (sin mes)', c.playedY === 2023 && c.playedM === null, JSON.stringify(c));
  ok('la tarjeta muestra "Jugado mar 2024" y "Jugado 2023"', (await page.locator('#list .card:has-text("Juego A")').innerText()).includes('Jugado mar 2024') && (await page.locator('#list .card:has-text("Juego C")').innerText()).includes('Jugado 2023'));
  const titles = async () => (await page.locator('#list .card').evaluateAll(es => es.map(e => e.getAttribute('aria-label') || e.innerText.split('\n')[0]))).join('|');
  const order = async () => (await page.locator('#list .card').evaluateAll(es => es.map(e => (e.innerText.match(/Juego (\w)/) || [])[1]))).join('');
  ok('el selector tiene las dos opciones nuevas', (await page.locator('#sort option').allInnerTexts()).slice(0, 2).join(',') === 'Jugado: reciente,Jugado: antiguo');
  await page.selectOption('#sort', 'played'); ok('Jugado: reciente → B(2025-11) D(2024-10) A(2024-03) C(2023) E(sin fecha)', (await order()) === 'BDACE', await order());
  await page.selectOption('#sort', 'playedAsc'); ok('Jugado: antiguo → C A D B E (sin fecha al final)', (await order()) === 'CADBE', await order());
  // persistencia de orden y fecha
  await page.reload(); await page.waitForSelector('#tabs button'); await page.click('#tabs button:has-text("Jugados")');
  ok('la ordenación elegida persiste', (await page.inputValue('#sort')) === 'playedAsc' && (await order()) === 'CADBE', await order());
  // quitar año borra el mes
  await page.click('#list .card:has-text("Juego A")'); await page.waitForSelector('#dlgEdit[open]'); await page.waitForTimeout(350);
  ok('la ficha recupera mes y año', (await page.inputValue('#ePlayedY')) === '2024' && (await page.inputValue('#ePlayedM')) === '3');
  await page.selectOption('#ePlayedY', ''); ok('quitar el año deshabilita y vacía el mes', (await page.locator('#ePlayedM').isDisabled()) && (await page.inputValue('#ePlayedM')) === '');
  await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open); await page.waitForTimeout(200);
  a = await g('kA'); ok('A sin fecha', a.playedY === null && a.playedM === null, JSON.stringify(a));
  // imagen exportada
  await page.evaluate(() => { view = 'list'; render(); }); await page.click('#btnImg'); await page.waitForFunction(() => /imagen/.test(document.querySelector('#imgNote').textContent), null, { timeout: 30000 });
  ok('la exportación usa el mismo orden y sin errores', (await page.innerText('#imgNote')).includes('5 juegos')); await page.click('#dlgImg [data-close]');
  // importar saneando
  fs.writeFileSync('imp18.json', JSON.stringify({ games: [{ id: 'x', title: 'X', status: 'played', playedY: 2022, playedM: 5 }, { id: 'y', title: 'Y', status: 'played', playedY: 1850, playedM: 99 }, { id: 'z', title: 'Z', status: 'played', playedM: 4 }] }));
  await page.click('#btnSettings'); await page.setInputFiles('#file', 'imp18.json'); await page.waitForSelector('#dlgAsk[open]'); await page.click('#askYes'); await page.waitForTimeout(400);
  const all = await page.evaluate(() => DB.all()); const by = id => all.find(x => x.id === id);
  ok('importar: válido se conserva; año absurdo y mes sin año se descartan', by('x').playedY === 2022 && by('x').playedM === 5 && by('y').playedY === null && by('y').playedM === null && by('z').playedM === null, JSON.stringify(all.map(x => [x.id, x.playedY, x.playedM])));
  ok('sin errores', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length); await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 400)); process.exit(1); } })();
