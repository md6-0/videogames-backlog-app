const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
}).listen(8098);
const out = []; const ok = (n, c) => out.push((c ? 'OK   ' : 'FAIL ') + n);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  page.on('dialog', d => { errs.push('DIÁLOGO NATIVO: ' + d.type() + ' ' + d.message()); d.dismiss(); }); await page.addInitScript(() => setInterval(() => { const d = document.getElementById('dlgAsk'); if (d && d.open) document.getElementById('askYes').click(); }, 40));
  await ctx.route('https://media.rawg.io/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(ROOT + '/icon-192.png') }));
  await page.goto('http://localhost:8098/'); await page.waitForSelector('#tabs button');
  const seed = (title, status, x = {}) => page.evaluate(async ([t, s, x]) => {
    const g = { id: crypto.randomUUID(), title: t, year: 2020, platforms: 'PC', cover: x.cover || '', rawgId: null, status: s, rating: x.rating ?? null, hours: x.hours ?? null, favorite: !!x.fav, notes: '', added: 1, updated: x.updated || Date.now(), finished: null };
    await DB.put(g); games.push(g);
  }, [title, status, x]);
  const tab = n => page.locator('#tabs button', { hasText: n });
  const OLD = ['playing','played','backlog','fav']; const secsAll = page.locator('#home .cat'); const secs = () => ({ count: () => secsAll.count(), nth: k => page.locator(`#home .cat:has(.strip[data-cat=${OLD[k]}])`) });

  ok('arranca en Inicio', (await page.locator('#tabs [aria-selected=true]').innerText()) === 'Inicio');
  ok('título Mi Biblioteca', (await page.innerText('#ttl')) === 'Mi Biblioteca');
  ok('Inicio vacío: mensaje', (await page.locator('#home .empty').count()) === 1);
  ok('sin barra de filtro en Inicio', await page.locator('#tools').isHidden());

  await seed('Hollow Knight', 'playing', { cover: 'https://media.rawg.io/a.jpg', hours: 12.5, updated: 5, rating: 9.5, fav: true });
  await seed('Hades', 'played', { updated: 4, rating: 6 });
  for (let i = 0; i < 14; i++) await seed('Pend ' + i, 'backlog', { updated: 100 + i });
  await page.evaluate(() => render());
  ok('4 carruseles', (await secs().count()) === 4);
  const heads = await page.locator('.cat-t').allInnerTexts();
  ok('orden Backlog, Jugando, Jugados, Favoritos', heads.join(',') === 'Backlog,Jugando,Jugados,Favoritos');
  ok('contador backlog = 14', (await secs().nth(2).locator('.cat-n').innerText()) === '14');
  ok('backlog limita a 12 + "Ver todos"', (await secs().nth(2).locator('.tile').count()) === 13 && (await secs().nth(2).locator('.tile.more').innerText()).includes('14'));
  ok('backlog ordenado por recientes', (await secs().nth(2).locator('.tile').first().getAttribute('aria-label')) === 'Pend 13');
  ok('nota como chip', (await secs().nth(0).locator('.chip').innerText()) === '9.5');
  ok('horas en tarjeta', (await secs().nth(0).locator('.tile').first().innerText()).includes('12,5 h'));
  ok('favoritos incluye el favorito', (await secs().nth(3).locator('.tile').count()) === 1);
  ok('sin scroll horizontal de página (360px)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const tabsOk = await page.evaluate(() => [...document.querySelectorAll('#tabs button')].every(b => b.scrollWidth <= b.clientWidth + 1));
  ok('pestañas caben en 360px', tabsOk);
  await page.screenshot({ path: 'shot-home.png' });

  // navegación
  await secs().nth(2).locator('.cat-h').click();
  ok('cabecera lleva a la categoría', (await page.locator('#tabs [aria-selected=true]').innerText()) === 'Backlog');
  ok('título = Backlog + contador', (await page.innerText('#ttl')).replace(/\s+/g, ' ').trim() === 'Backlog 14');
  ok('barra de filtro visible', await page.locator('#tools').isVisible());
  ok('lista de 14', (await page.locator('.card').count()) === 14);
  await page.fill('#q', 'Pend 1');
  ok('filtro funciona', (await page.locator('.card').count()) === 5); // Pend 1, 10, 11, 12, 13
  await page.goBack();
  ok('atrás vuelve a Inicio', (await page.locator('#tabs [aria-selected=true]').innerText()) === 'Inicio' && await page.locator('#home').isVisible());
  await page.goForward();
  ok('adelante vuelve a Backlog', (await page.locator('#tabs [aria-selected=true]').innerText()) === 'Backlog');
  ok('filtro se reinicia al cambiar de página', (await page.inputValue('#q')) === '');
  await tab('Inicio').click();
  await secs().nth(2).locator('.tile.more').click();
  ok('"Ver todos" lleva a Backlog', (await page.locator('#tabs [aria-selected=true]').innerText()) === 'Backlog');
  await tab('Inicio').click();

  // editar desde Inicio y quedarse en Inicio
  await secs().nth(0).locator('.tile').first().click(); await page.waitForSelector('#dlgEdit[open]');
  ok('tocar tarjeta abre la ficha', (await page.inputValue('#eTitle')) === 'Hollow Knight');
  await page.locator('#eStatus button', { hasText: 'Jugados' }).click(); await page.click('#eSave'); await page.waitForTimeout(150);
  ok('guardar desde Inicio se queda en Inicio', (await page.locator('#tabs [aria-selected=true]').innerText()) === 'Inicio');
  ok('Jugando queda vacío con aviso', (await secs().nth(0).locator('.cat-empty').count()) === 1);
  ok('Jugados ahora tiene 2', (await secs().nth(1).locator('.cat-n').innerText()) === '2');

  // añadir desde Inicio => Backlog por defecto
  await page.click('#fab'); await page.click('#manual'); await page.waitForSelector('#dlgEdit[open]');
  ok('nuevo desde Inicio = Backlog', (await page.locator('#eStatus [aria-pressed=true]').innerText()) === 'Backlog');
  await page.fill('#eTitle', 'Nuevo'); await page.click('#eSave'); await page.waitForTimeout(150);
  ok('sigue en Inicio', await page.locator('#home').isVisible());
  // desde una categoría: aterriza en la categoría del estado
  await tab('Jugando').click(); await page.click('#fab'); await page.click('#manual'); await page.waitForSelector('#dlgEdit[open]');
  ok('nuevo desde Jugando = Jugando', (await page.locator('#eStatus [aria-pressed=true]').innerText()) === 'Jugando');
  await page.fill('#eTitle', 'En curso'); await page.locator('#eStatus button', { hasText: 'Backlog' }).click(); await page.click('#eSave'); await page.waitForTimeout(150);
  ok('guardar con otro estado salta a esa página', (await page.locator('#tabs [aria-selected=true]').innerText()) === 'Backlog');

  ok('sin errores', errs.length === 0);
  console.log(out.join('\n')); console.log(out.filter(x => x.startsWith('FAIL')).length + ' fallos de ' + out.length);
  await b.close(); srv.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
