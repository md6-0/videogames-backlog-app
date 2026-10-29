const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const m = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  res.writeHead(200, { 'Content-Type': m[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }).listen(8094);
var errs = []; const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch();
  for (const [name, vp] of [['móvil 390', { width: 390, height: 900 }], ['tablet 1100', { width: 1100, height: 900 }]]) {
    const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: vp });
    const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
    await ctx.route('https://media.rawg.io/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(require('path').join(__dirname, 'fixtures', 'c1.png')) }));
    await page.goto('http://localhost:8094/'); await page.waitForSelector('#tabs button');
    await page.evaluate(async () => { for (let i = 0; i < 20; i++) { const g = { id: 'g' + i, title: 'Juego ' + i, year: 2019, platforms: 'PC', cover: 'https://media.rawg.io/c1.png', status: 'backlog', rating: null, hours: null, favorite: false, notes: '', added: 1, updated: 100 - i }; await DB.put(g); games.push(g); } render(); });
    await page.click('#tabs button:has-text("Backlog")');
    const ncols = async () => page.evaluate(() => { const l = document.querySelector('#list'); const xs = new Set([...l.children].filter(c => c.matches('.card,.tile')).map(c => Math.round(c.getBoundingClientRect().left))); return xs.size; });
    const setv = async (view, id, v) => { await page.evaluate(v2 => { view = v2; store.set('view', v2); render(); }, view); await page.click('#btnSettings'); await page.selectOption('#' + id, v); await page.click('#dlgSet [data-close]'); await page.waitForTimeout(100); };
    await page.evaluate(() => { view = 'grid'; render(); }); const autoG = await ncols();
    await page.evaluate(() => { view = 'list'; render(); }); const autoL = await ncols();
    ok(`${name}: automático lista=${autoL}, cuadrícula=${autoG}`, autoL >= 1 && autoG >= 3);
    await setv('grid', 'colsGrid', '2'); ok(`${name}: cuadrícula 2 columnas`, (await ncols()) === 2, await ncols());
    await setv('grid', 'colsGrid', '6'); ok(`${name}: cuadrícula 6 columnas`, (await ncols()) === 6, await ncols());
    await setv('list', 'colsList', '3'); ok(`${name}: lista 3 columnas`, (await ncols()) === 3, await ncols());
    await setv('list', 'colsList', '1'); ok(`${name}: lista 1 columna`, (await ncols()) === 1, await ncols());
    ok(`${name}: la cuadrícula conserva su propio valor (6)`, await page.evaluate(async () => { view = 'grid'; render(); return true; }) && (await ncols()) === 6);
    await page.evaluate(() => store.set('view', 'grid')); await page.reload(); await page.waitForSelector('#tabs button'); await page.click('#tabs button:has-text("Backlog")');
    ok(`${name}: persiste tras recargar`, (await ncols()) === 6, await ncols());
    ok(`${name}: sin scroll horizontal`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.click('#btnSettings'); ok(`${name}: selects reflejan lo guardado`, (await page.inputValue('#colsGrid')) === '6' && (await page.inputValue('#colsList')) === '1'); 
    await page.selectOption('#colsGrid', '0'); await page.click('#dlgSet [data-close]'); await page.waitForTimeout(100);
    ok(`${name}: volver a Automático = ${autoG}`, (await ncols()) === autoG, await ncols());
    if (name.startsWith('móvil')) { await page.click('#btnSettings'); await page.screenshot({ path: 'settings-cols.png' }); }
    await ctx.close();
  }
  ok('sin errores', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length);
  await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 500)); process.exit(1); } })();
