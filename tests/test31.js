// Recordatorio de copia de seguridad en Inicio.
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const MIME = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': MIME[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8135);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
const DAY = 864e5;
(async () => { try {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], acceptDownloads: true }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8135/'); await page.waitForSelector('#tabs button');
  const seed = addedAgo => page.evaluate(async ago => { const g = { id: 'a', title: 'Hades', year: 2020, platforms: '', cover: '', status: 'backlog', favorite: false, added: Date.now() - ago, updated: Date.now() }; await DB.replaceAll([g]); games = [g]; render(); }, addedAgo);
  const card = () => page.locator('#home .bk-card');
  await page.evaluate(() => { localStorage.removeItem('lastBackup'); localStorage.removeItem('backupSnooze'); });
  await seed(5 * DAY); ok('biblioteca reciente sin copias: sin recordatorio', (await card().count()) === 0);
  await seed(40 * DAY); ok('primer juego hace 40 días y sin copias: recordatorio', (await card().count()) === 1 && (await card().innerText()).includes('Aún no has hecho ninguna copia'), await card().innerText().catch(() => ''));
  await page.evaluate(() => { localStorage.setItem('lastBackup', String(Date.now() - 34 * 864e5)); render(); });
  ok('última copia hace 34 días: lo dice', (await card().innerText()).includes('Hace 34 días'), await card().innerText());
  await page.click('#home .bk-card button:has-text("Más tarde")'); ok('"Más tarde" lo oculta', (await card().count()) === 0);
  await page.evaluate(() => { localStorage.setItem('backupSnooze', String(Date.now() - 1)); render(); }); ok('pasada la semana vuelve a salir', (await card().count()) === 1);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#home .bk-card button:has-text("Exportar")')]);
  ok('"Exportar" descarga la copia', /^biblioteca-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  await page.waitForTimeout(200); ok('tras exportar desaparece', (await card().count()) === 0);
  await page.click('#btnSettings'); await page.waitForTimeout(300);
  ok('ajustes muestran la fecha de la última copia', (await page.innerText('#lastBackup')).startsWith('Última copia:'), await page.innerText('#lastBackup'));
  await page.evaluate(() => { localStorage.removeItem('lastBackup'); paintLastBackup(); }); ok('sin copias: lo indica', (await page.innerText('#lastBackup')) === 'Aún no has hecho ninguna copia.');
  await page.evaluate(() => $('#dlgSet').close()); await page.click('#tabs button:has-text("Backlog")'); ok('en otras pantallas no aparece', (await page.locator('.bk-card:visible').count()) === 0);
  ok('sin errores', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length); await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 500)); process.exit(1); } })();
