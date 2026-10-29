const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const m = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  res.writeHead(200, { 'Content-Type': m[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }).listen(8091);
var errs = []; const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await ctx.route('https://media.rawg.io/**', r => { const u = r.request().url(); if (u.includes('nocors')) return r.abort('failed');
    const n = u.match(/c(\d)\.png/)[1]; r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(require('path').join(__dirname, 'fixtures', `c${n}.png`)) }); });
  await page.goto('http://localhost:8091/'); await page.waitForSelector('#tabs button');
  ok('en Inicio no hay botón de imagen', (await page.locator('#btnImg:visible').count()) === 0);
  await page.click('#tabs button:has-text("Jugados")');
  ok('en categoría hay botón', (await page.locator('#btnImg:visible').count()) === 1);
  await page.click('#btnImg'); await page.waitForTimeout(300);
  ok('lista vacía: aviso y sin diálogo', (await page.locator('#dlgImg[open]').count()) === 0 && (await page.locator('.toast').last().innerText()).includes('No hay'));
  await page.evaluate(async () => {
    const mk = (i, over) => ({ id: 'g' + i, title: 'Juego número ' + i + (i % 7 === 0 ? ' con un título larguísimo que no cabe en dos líneas de ninguna manera' : ''), year: 2000 + i % 25, platforms: i % 3 ? 'PC, PlayStation' : '', cover: `https://media.rawg.io/c${i % 8}.png`, status: 'played', rating: i % 5 === 0 ? null : (i % 20) / 2, hours: i % 4 ? i + 0.5 : null, favorite: false, notes: '', added: 1, updated: 1000 - i, rank: null, ...over });
    const L = []; for (let i = 0; i < 150; i++) L.push(mk(i, i === 3 ? { cover: '' } : i === 4 ? { cover: 'https://media.rawg.io/nocors.png' } : {}));
    for (const g of L) { await DB.put(g); games.push(g); } render(); });
  await page.evaluate(() => { view = 'grid'; }); await page.click('#btnImg'); await page.waitForSelector('#dlgImg[open]');
  await page.waitForFunction(() => /imágenes|imagen\./.test(document.querySelector('#imgNote').textContent), null, { timeout: 60000 });
  let note = await page.innerText('#imgNote');
  ok('cuadrícula: 150 juegos → 2 imágenes', /150 juegos, 2 imágenes/.test(note), note);
  ok('avisa de 1 portada que no cargó', /Sin portada en la imagen.*Juego número 4/.test(note), note);
  ok('modo inicial = vista actual (cuadrícula)', (await page.getAttribute('#imgMode button[data-m=grid]', 'aria-pressed')) === 'true');
  const dims = async () => await page.evaluate(async () => Promise.all(IMG.blobs.map(async b => { const bm = await createImageBitmap(b); return [b.type, bm.width, bm.height]; })));
  let d = await dims();
  ok('PNG de 1080 de ancho, ≤12000 de alto', d.every(x => x[0] === 'image/png' && x[1] === 1080 && x[2] <= 12000 && x[2] > 500), JSON.stringify(d));
  ok('2 vistas previas', (await page.locator('#imgPrev img').count()) === 2);
  const save = async (name) => fs.writeFileSync(name, Buffer.from(await page.evaluate(async () => { const buf = new Uint8Array(await IMG.blobs[0].arrayBuffer()); let s = ''; for (const c of buf) s += String.fromCharCode(c); return btoa(s); }), 'base64'));
  await save('export-grid.png');
  // descarga
  const dl = page.waitForEvent('download'); await page.click('#imgDl'); const dw = await dl;
  ok('descarga con nombre biblioteca-jugados-FECHA-1.png', /^biblioteca-jugados-\d{4}-\d\d-\d\d-1\.png$/.test(dw.suggestedFilename()), dw.suggestedFilename());
  ok('compartir oculto si el navegador no lo soporta', (await page.locator('#imgShare:visible').count()) === 0);
  // lista
  await page.click('#imgMode button[data-m=list]');
  await page.waitForFunction(() => /3 imágenes/.test(document.querySelector('#imgNote').textContent), null, { timeout: 60000 });
  d = await dims(); ok('lista: 3 imágenes ≤12000', d.length === 3 && d.every(x => x[2] <= 12000), JSON.stringify(d));
  await save('export-list.png');
  // orden/filtro: con filtro
  await page.click('#dlgImg [data-close]');
  await page.fill('#q', 'número 1'); await page.click('#btnImg'); await page.waitForSelector('#dlgImg[open]');
  await page.waitForFunction(() => /imagen|imágenes/.test(document.querySelector('#imgNote').textContent), null, { timeout: 60000 });
  const n = await page.evaluate(() => IMG.items.length); const exp = await page.evaluate(() => visible().length);
  ok('respeta el filtro', n === exp && n < 150, n + ' vs ' + exp);
  await page.click('#dlgImg [data-close]'); await page.waitForTimeout(200);
  ok('al cerrar se liberan recursos', await page.evaluate(() => IMG.blobs.length === 0 && IMG.bmp.size === 0 && IMG.urls.length === 0));
  // share simulado
  await page.evaluate(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = async d => { window.__shared = d.files.map(f => f.name + ':' + f.type); }; });
  await page.fill('#q', ''); await page.click('#btnImg'); await page.waitForSelector('#dlgImg[open]');
  await page.waitForFunction(() => /imágenes/.test(document.querySelector('#imgNote').textContent), null, { timeout: 60000 });
  ok('compartir visible si hay soporte', (await page.locator('#imgShare:visible').count()) === 1);
  await page.click('#imgShare'); await page.waitForTimeout(200);
  const sh = await page.evaluate(() => window.__shared);
  ok('compartir manda 2 PNG', sh && sh.length === 2 && sh.every(x => x.endsWith(':image/png')), JSON.stringify(sh));
  ok('sin errores', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length);
  await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 400)); process.exit(1); } })();
