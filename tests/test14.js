const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png'}[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8096);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const page = await ctx.newPage();
  const errs = [], natives = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => { natives.push(d.type() + ': ' + d.message()); d.dismiss(); });
  await page.goto('http://localhost:8096/'); await page.waitForSelector('#tabs button');
  const seed = () => page.evaluate(async () => { await DB.replaceAll([]); games = []; for (const [i, t] of ['A', 'B'].entries()) { const g = { id: 'k' + t, title: 'Juego ' + t, year: 2019, platforms: '', cover: '', status: 'backlog', rating: null, hours: null, favorite: false, notes: '', added: 1, updated: 10 - i }; await DB.put(g); games.push(g); } render(); });
  await seed();
  const count = () => page.evaluate(() => DB.all().then(a => a.length));
  await page.click('#tabs button:has-text("Backlog")');
  // 1) eliminar desde la ficha: borra al instante y ofrece Deshacer
  await page.click('#list .card:has-text("Juego A")'); await page.waitForSelector('#dlgEdit[open]'); await page.click('#eDel'); await page.waitForTimeout(250);
  ok('eliminar borra y cierra todo, sin pedir confirmación', (await count()) === 1 && (await page.locator('dialog[open]').count()) === 0);
  ok('aviso con nombre y botón Deshacer', (await page.locator('.toast .tm').innerText()).includes('Juego A') && (await page.locator('.toast .ta').innerText()) === 'Deshacer');
  await page.click('.toast .ta'); await page.waitForTimeout(250);
  ok('Deshacer recupera el juego con sus datos', (await count()) === 2 && (await page.locator('#list .card:has-text("Juego A")').count()) === 1);
  const dupe = await page.evaluate(() => games.filter(g => g.title === 'Juego A').length); ok('sin duplicados al deshacer', dupe === 1, dupe);
  await page.click('#list .card:has-text("Juego A")'); await page.waitForSelector('#dlgEdit[open]'); await page.click('#eDel'); await page.waitForTimeout(250);
  await page.waitForSelector('.toast .ta', { state: 'detached', timeout: 8000 });
  ok('pasado el tiempo el aviso desaparece y sigue borrado', (await count()) === 1);
  // 3) importar
  fs.writeFileSync('imp14.json', JSON.stringify({ games: [{ id: 'z', title: 'Z', status: 'played' }] }));
  await page.click('#btnSettings'); await page.setInputFiles('#file', 'imp14.json'); await page.waitForSelector('#dlgAsk[open]');
  ok('importar: texto con cifras', /1 juegos actuales por 1/.test(await page.innerText('#askText')), await page.innerText('#askText'));
  await page.click('#askNo'); await page.waitForTimeout(200); ok('importar cancelado: no cambia', (await count()) === 1);
  await page.setInputFiles('#file', 'imp14.json'); await page.waitForSelector('#dlgAsk[open]'); await page.click('#askYes'); await page.waitForTimeout(300);
  ok('importar confirmado', (await count()) === 1);
  // 4) toast más ancho
  await page.evaluate(() => toast('Guardado'));
  const w = await page.evaluate(() => document.querySelector('.toast').getBoundingClientRect().width);
  ok('aviso corto ocupa ≥ 300 px en móvil (390)', w >= 300 && w <= 390 * .93, String(w));
  await page.screenshot({ path: 'toast-wide.png' });
  ok('ningún diálogo nativo', natives.length === 0, natives.join('|'));
  ok('sin errores', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length); await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 400)); process.exit(1); } })();
