const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': {'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8105);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch();
  for (const [name, dev, vp] of [['móvil', devices['Pixel 7'], { width: 390, height: 844 }], ['tablet', devices['Pixel 7'], { width: 1100, height: 800 }], ['móvil bajo', devices['Pixel 7'], { width: 390, height: 520 }]]) {
    const ctx = await b.newContext({ ...dev, viewport: vp }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    const n = { v: 0 };
    await ctx.route('https://api.rawg.io/**', async r => { const q = new URL(r.request().url()).searchParams.get('search'); await new Promise(x => setTimeout(x, 150));
      if (q === 'err') return r.fulfill({ status: 401, body: '{}' });
      const cnt = q === 'none' ? 0 : q === 'one' ? 1 : 12; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: Array.from({ length: cnt }, (_, i) => ({ id: i, name: 'Resultado ' + i + ' de ' + q, released: '2020-01-01', background_image: null, parent_platforms: [{ platform: { name: 'PC' } }] })) }) }); });
    await page.goto('http://localhost:8105/'); await page.waitForSelector('#tabs button'); await page.evaluate(() => store.set('rawgKey', 'x'));
    await page.click('#fab'); await page.waitForTimeout(500);
    const H = async () => Math.round((await page.locator('#dlgAdd').boundingBox()).height);
    const h0 = await H(); const hs = [h0];
    for (const q of ['ab', 'one', 'none', 'many', 'err']) { await page.fill('#sq', q); await page.press('#sq', 'Enter'); await page.waitForTimeout(q === 'ab' ? 100 : 700); hs.push(await H()); if (q === 'ab') { await page.waitForTimeout(500); hs.push(await H()); } }
    await page.fill('#sq', 'many'); await page.press('#sq', 'Enter'); await page.waitForSelector('#results .res'); hs.push(await H());
    ok(`${name}: altura constante (${hs.join(',')}) y ≤ viewport`, hs.every(x => Math.abs(x - h0) <= 1) && h0 <= vp.height, JSON.stringify(hs));
    const m = await page.evaluate(() => { const r = document.querySelector('#results'); return { scroll: r.scrollHeight > r.clientHeight, ch: r.clientHeight }; });
    ok(`${name}: con 12 resultados la lista se desplaza dentro (alto útil ${m.ch}px)`, m.scroll && m.ch > 60, JSON.stringify(m));
    const vis = await page.evaluate(() => { const d = document.querySelector('#dlgAdd').getBoundingClientRect(), bt = document.querySelector('#manual').getBoundingClientRect(), s = document.querySelector('#sq').getBoundingClientRect(); return bt.bottom <= d.bottom + 1 && bt.top >= d.top && s.top >= d.top && bt.bottom <= innerHeight; });
    ok(`${name}: buscador y "Añadir a mano" siempre visibles`, vis);
    await page.screenshot({ path: `add-${name.replace(' ', '-')}.png` });
    ok(`${name}: sin errores`, errs.length === 0, errs.join('|')); await ctx.close();
  }
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length); await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 400)); process.exit(1); } })();
