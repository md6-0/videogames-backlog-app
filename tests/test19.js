const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': {'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8103);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 1500 } }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8103/'); await page.waitForSelector('#tabs button');
  const now = await page.evaluate(() => { const d = new Date(); return [d.getFullYear(), d.getMonth() + 1]; });
  const seed = () => page.evaluate(async () => { await DB.replaceAll([]); games = []; for (const [i, [t, s, y, m]] of [['A', 'backlog'], ['B', 'backlog'], ['C', 'backlog'], ['D', 'played', 2020, 6], ['E', 'playing']].entries()) { const g = { id: 'k' + t, title: 'Juego ' + t, year: 2019, platforms: '', cover: '', status: s, rating: null, hours: null, favorite: false, notes: '', added: 1, updated: 100 - i, playedY: y || null, playedM: m || null }; await DB.put(g); games.push(g); } render(); });
  const g = id => page.evaluate(i => DB.all().then(a => a.find(x => x.id === i)), id);
  const is = (x, y, m) => x.playedY === y && x.playedM === m;
  await seed();
  // 1) ficha: cambiar a Jugados rellena selects y guarda
  await page.click('#tabs button:has-text("Backlog")'); await page.click('#list .card:has-text("Juego A")'); await page.waitForSelector('#dlgEdit[open]'); await page.waitForTimeout(350);
  ok('ficha en Backlog: fecha vacía', (await page.inputValue('#ePlayedY')) === '');
  await page.click('#eStatus button:has-text("Jugados")');
  ok('al elegir Jugados se rellena mes y año actuales', (await page.inputValue('#ePlayedY')) === String(now[0]) && (await page.inputValue('#ePlayedM')) === String(now[1]));
  await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open); await page.waitForTimeout(200);
  ok('guardado con fecha actual', is(await g('kA'), now[0], now[1]), JSON.stringify(await g('kA')));
  // 2) ficha: una fecha puesta a mano no se pisa
  await page.click('#tabs button:has-text("Backlog")'); await page.click('#list .card:has-text("Juego B")'); await page.waitForSelector('#dlgEdit[open]'); await page.waitForTimeout(350);
  await page.selectOption('#ePlayedY', '2021'); await page.selectOption('#ePlayedM', '2'); await page.click('#eStatus button:has-text("Jugados")');
  ok('fecha manual no se pisa', (await page.inputValue('#ePlayedY')) === '2021' && (await page.inputValue('#ePlayedM')) === '2');
  await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open); await page.waitForTimeout(200);
  ok('B guarda 2021-02', is(await g('kB'), 2021, 2));
  // 5) arrastre en Inicio hacia Jugados
  await page.click('#tabs button:has-text("Inicio")');
  const tile = await page.locator('#home .strip[data-cat=playing] .tile').first().boundingBox(); const tgt = await page.locator('#home .strip[data-cat=played]').boundingBox();
  await page.mouse.move(tile.x + 40, tile.y + 60); await page.mouse.down(); await page.mouse.move(tile.x + 50, tile.y + 20, { steps: 3 }); const tg2 = await page.locator('#home .strip[data-cat=played]').boundingBox(); ok('al sacar el único juego de una fila, las demás no se desplazan', Math.abs(tg2.y - tgt.y) < 8, tg2.y + ' vs ' + tgt.y); await page.mouse.move(tg2.x + 60, tg2.y + tg2.height / 2, { steps: 14 }); await page.mouse.up(); await page.waitForTimeout(400);
  const e = await g('kE'); ok('arrastrar a Jugados rellena la fecha', e.status === 'played' && is(e, now[0], now[1]), JSON.stringify(e));
  // 6) alta directa desde la pestaña Jugados
  await page.click('#tabs button:has-text("Jugados")'); await page.evaluate(() => store.set('rawgKey', 'x'));
  await page.click('#fab'); await page.fill('#sq', 'Nuevo directo'); await page.click('#manual'); await page.waitForSelector('#dlgEdit[open]'); await page.waitForTimeout(350);
  ok('alta en Jugados: la ficha ya trae mes y año actuales', (await page.inputValue('#ePlayedY')) === String(now[0]) && (await page.inputValue('#ePlayedM')) === String(now[1]));
  await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open); await page.waitForTimeout(200);
  const nd = await page.evaluate(() => DB.all().then(a => a.find(x => x.title === 'Nuevo directo'))); ok('alta en Jugados guardada con fecha', is(nd, now[0], now[1]), JSON.stringify(nd));
  // 7) alta en Backlog: sin fecha
  await page.click('#tabs button:has-text("Backlog")'); await page.click('#fab'); await page.fill('#sq', 'Nuevo backlog'); await page.click('#manual'); await page.waitForSelector('#dlgEdit[open]'); await page.waitForTimeout(350);
  ok('alta en Backlog: sin fecha', (await page.inputValue('#ePlayedY')) === ''); await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open);
  // 8) quitar fecha deliberadamente en un juego ya Jugado no la vuelve a poner
  await page.click('#tabs button:has-text("Jugados")'); await page.click('#list .card:has-text("Juego D")'); await page.waitForSelector('#dlgEdit[open]'); await page.waitForTimeout(350);
  await page.selectOption('#ePlayedY', ''); await page.click('#eStatus button:has-text("Jugados")'); await page.click('#eSave'); await page.waitForFunction(() => !document.querySelector('#dlgEdit').open); await page.waitForTimeout(200);
  ok('quitar fecha en un Jugado ya existente se respeta', is(await g('kD'), null, null), JSON.stringify(await g('kD')));
  ok('sin errores', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length); await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 400)); process.exit(1); } })();
