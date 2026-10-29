// Escritorio: ocupa todo el ancho, el Inicio no muestra la lista tras volver (con columnas fijadas) y los carruseles se mueven con flechas.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const MIME = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': MIME[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8137);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 2000, height: 946 } })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8137/'); await page.waitForSelector('#tabs button');
  await page.evaluate(async () => { store.set('colsList', '2'); store.set('colsGrid', '5');
    const gs = Array.from({ length: 40 }, (_, i) => ({ id: 'g' + i, title: 'Juego ' + i, year: 2020, platforms: 'PC', cover: '', status: ['backlog', 'playing', 'played'][i % 3], favorite: i % 5 == 0, rating: 8, rank: i, added: Date.now(), updated: Date.now() }));
    await DB.replaceAll(gs); games = gs; render(); });
  const listShown = () => page.evaluate(() => getComputedStyle(document.querySelector('#list')).display !== 'none');
  for (const [mode, cols] of [['list', '2'], ['grid', '5'], ['list', '0']]) {
    await page.evaluate(([m, c]) => { setView(m); store.set(m === 'grid' ? 'colsGrid' : 'colsList', c); render(); }, [mode, cols]);
    for (const t of ['Backlog', 'Jugando', 'Jugados', 'Favoritos']) {
      await page.click(`#tabs button:has-text("${t}")`); await page.waitForTimeout(120);
      await page.click('#tabs button:has-text("Inicio")'); await page.waitForTimeout(120);
      ok(`Inicio sin lista tras volver de ${t} (${mode}, columnas ${cols})`, !(await listShown()));
    }
    await page.click('#tabs button:has-text("Backlog")'); await page.waitForTimeout(120); await page.goBack(); await page.waitForTimeout(150);
    ok(`Inicio sin lista tras "atrás" (${mode}, columnas ${cols})`, !(await listShown()));
  }
  await page.click('#tabs button:has-text("Inicio")'); await page.waitForTimeout(150);
  const m = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { rail: r('nav.tabs').width, title: r('.cat-t').left, strip: r('.strip'), vw: innerWidth }; });
  ok('el contenido empieza junto a la barra lateral (sin hueco)', m.title - m.rail <= 40, JSON.stringify(m));
  ok('los carruseles ocupan todo el ancho', m.strip.width >= m.vw - m.rail - 2, JSON.stringify(m));
  const fab = await page.evaluate(() => { const f = document.querySelector('.fab').getBoundingClientRect(); return innerWidth - f.right; }); ok('el botón + queda cerca del borde del contenido', fab <= 40, fab);
  const strip = page.locator('.cat').nth(2).locator('.strip'); await page.locator('.cat').nth(2).hover();
  ok('sin flecha atrás al principio', await page.locator('.cat').nth(2).locator('.strip-wrap:not(.can-prev)').count() === 1);
  ok('flecha siguiente disponible', await page.locator('.cat').nth(2).locator('.strip-wrap.can-next').count() === 1);
  const x0 = await strip.evaluate(e => e.scrollLeft);
  await page.locator('.cat').nth(2).locator('.strip-nav.next').click(); await page.waitForTimeout(800);
  const x1 = await strip.evaluate(e => e.scrollLeft); ok('la flecha desplaza el carrusel', x1 > x0 + 200, `${x0} -> ${x1}`);
  ok('aparece la flecha atrás', await page.locator('.cat').nth(2).locator('.strip-wrap.can-prev').count() === 1);
  await page.locator('.cat').nth(2).locator('.strip-nav.prev').click(); await page.waitForTimeout(800);
  ok('la flecha atrás vuelve', (await strip.evaluate(e => e.scrollLeft)) < 5);
  await page.setViewportSize({ width: 3000, height: 946 }); await page.waitForTimeout(300);
  ok('sin flechas cuando todo cabe', await page.locator('.cat').nth(0).locator('.strip-wrap.can-next').count() === 0);
  ok('sin errores de JS', !errs.length, errs.join('|'));
} catch (e) { out.push('FAIL excepción ' + e.message); } console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length); srv.close(); process.exit(0); })();
