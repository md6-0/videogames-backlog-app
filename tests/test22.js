const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': {'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8107);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { try {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8107/'); await page.waitForSelector('#tabs button');
  await page.evaluate(() => { window.__skip = 0; offerUpdate({ postMessage: m => { if (m.type === 'SKIP_WAITING') window.__skip++; } }); });
  await page.waitForTimeout(500);
  const info = () => page.evaluate(() => { const u = document.querySelector('#upd'), r = u.getBoundingClientRect(), g = u.querySelector('#updGo').getBoundingClientRect(); const e = document.elementFromPoint(g.left + g.width / 2, g.top + g.height / 2);
    return { parent: u.parentNode.id || u.parentNode.tagName, top: Math.round(r.top), w: Math.round(r.width), vis: !u.classList.contains('hidden') && r.height > 0, clickable: e === u.querySelector('#updGo') || u.querySelector('#updGo').contains(e) }; });
  let i = await info(); ok('sin paneles: banner en body, arriba y clicable', i.parent === 'BODY' && i.top === 0 && i.vis && i.clickable, JSON.stringify(i));
  await page.click('#btnSettings'); await page.waitForTimeout(500);
  i = await info(); ok('con Ajustes abierto: el banner está dentro del panel, arriba, visible y clicable', i.parent === 'dlgSet' && i.top === 0 && i.w === 412 && i.vis && i.clickable, JSON.stringify(i));
  await page.screenshot({ path: 'upd-over-settings.png' });
  await page.click('#updX'); ok('✕ lo oculta también dentro del panel', !(await info()).vis);
  await page.evaluate(() => offerUpdate({ postMessage: m => { if (m.type === 'SKIP_WAITING') window.__skip++; } })); await page.waitForTimeout(400);
  i = await info(); ok('aparecer mientras Ajustes está abierto: visible y clicable', i.parent === 'dlgSet' && i.vis && i.clickable, JSON.stringify(i));
  await page.click('#dlgSet [data-close]'); await page.waitForTimeout(500);
  i = await info(); ok('al cerrar Ajustes vuelve al body y sigue visible', i.parent === 'BODY' && i.vis && i.top === 0, JSON.stringify(i));
  // panel de confirmación sobre otro panel: el banner sigue al de arriba
  await page.evaluate(() => { openSettings(); }); await page.waitForTimeout(400);
  await page.evaluate(() => { ask({ title: 'T', text: 'X' }); }); await page.waitForTimeout(400);
  i = await info(); ok('con un panel encima de otro, el banner va al de arriba (dlgAsk)', i.parent === 'dlgAsk' && i.vis && i.clickable, JSON.stringify(i));
  await page.click('#askNo'); await page.waitForTimeout(400); i = await info(); ok('al cerrar el de arriba pasa al de debajo (dlgSet)', i.parent === 'dlgSet', JSON.stringify(i));
  // Actualizar con Ajustes abierto procede
  await page.click('#updGo'); await page.waitForTimeout(200); ok('Actualizar funciona con Ajustes abierto (envía SKIP_WAITING)', (await page.evaluate(() => window.__skip)) === 1);
  await page.click('#dlgSet [data-close]'); await page.waitForTimeout(400);
  // con la ficha abierta se protege
  await page.evaluate(() => { games.push({ id: 'z', title: 'Z', status: 'backlog', favorite: false, added: 1, updated: 1 }); openEdit('z'); }); await page.waitForTimeout(400);
  await page.click('#updGo'); await page.waitForTimeout(200);
  ok('con la ficha abierta no actualiza y avisa (warning)', (await page.evaluate(() => window.__skip)) === 1 && (await page.locator('.toast.t-warning').count()) === 1);
  await page.click('#dlgEdit [data-close]'); await page.waitForTimeout(3000);
  // toasts con estados
  for (const [t, color] of [['success', '--good'], ['warning', '--mid'], ['error', '--bad'], ['info', '--accent']]) {
    await page.evaluate(([t]) => toast('Mensaje ' + t, t), [t]); await page.waitForTimeout(350);
    const r = await page.evaluate(([t, v]) => { const e = document.querySelector('.toast'); const cs = getComputedStyle(e); const want = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      const probe = document.createElement('i'); probe.style.color = want; document.body.append(probe); const wc = getComputedStyle(probe).color; probe.remove();
      return { cls: e.className, role: e.getAttribute('role'), icon: e.querySelector('.ti').textContent, border: cs.borderTopColor === wc, iconBg: getComputedStyle(e.querySelector('.ti')).backgroundColor === wc, open: e.matches(':popover-open') }; }, [t, color]);
    ok(`toast ${t}: clase, icono "${r.icon}", color y capa superior`, r.cls.includes('t-' + t) && r.border && r.iconBg && r.open && r.role === (t === 'error' ? 'alert' : 'status'), JSON.stringify(r));
    await page.screenshot({ path: `toast-${t}.png` }); await page.waitForTimeout(2300);
  }
  await page.evaluate(() => toast('Tipo raro', 'zzz')); ok('tipo desconocido cae a info', (await page.locator('.toast.t-info').count()) === 1); await page.waitForTimeout(2500);
  await page.evaluate(() => openSettings()); await page.waitForTimeout(400); await page.evaluate(() => toast('Sobre el panel', 'success')); await page.waitForTimeout(350);
  ok('toast con panel abierto: en la capa superior', await page.evaluate(() => document.querySelector('.toast').matches(':popover-open')));
  ok('sin errores', errs.length === 0, errs.join('|'));
  console.log(out.join('\n')); console.log('FALLOS:', out.filter(l => l.startsWith('FAIL')).length, '/', out.length); await b.close(); srv.close();
} catch (e) { console.log(out.join('\n')); console.log('CRASH', String(e).slice(0, 500)); process.exit(1); } })();
