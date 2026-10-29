const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(require('path').resolve(__dirname, '..'), p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': {'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); }).listen(8098);
const out = []; const ok = (n, c, x = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x));
(async () => { const b = await chromium.launch(); 
  for (const rm of ['no-preference', 'reduce']) {
    const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: rm }); const page = await ctx.newPage();
    await page.goto('http://localhost:8098/'); await page.waitForSelector('#tabs button');
    const r = await page.evaluate(async () => { const d = document.querySelector('#dlgSet'); const sample = () => { const cs = getComputedStyle(d); return [+(+cs.opacity).toFixed(2), cs.display, d.open]; };
      const wait = ms => new Promise(r => setTimeout(r, ms)); const o = {};
      openSettings(); o.open0 = sample(); await wait(100); o.open100 = sample(); await wait(350); o.open450 = sample();
      d.close(); o.close0 = sample(); await wait(100); o.close100 = sample(); await wait(350); o.close450 = sample();
      toast('Hola'); await wait(30); o.toast30 = +getComputedStyle(document.querySelector('.toast')).opacity; await wait(2250); o.toastOut = document.querySelector('.toast') ? document.querySelector('.toast').className : 'gone'; await wait(300); o.toastGone = !document.querySelector('.toast');
      return o; });
    const t = rm === 'reduce' ? 'movimiento reducido' : 'movimiento normal';
    ok(t + ': el panel termina visible al abrir', r.open450[0] === 1 && r.open450[2]);
    ok(t + ': el panel desaparece del todo al cerrar', r.close450[1] === 'none' && !r.close450[2]);
    ok(t + ': el aviso se retira solo', r.toastGone);
    if (rm === 'reduce') ok(t + ': sin animación (abre y cierra al instante)', r.open100[0] === 1 && r.close100[1] === 'none');
    else ok(t + ': animado (a los 100 ms está a medias)', r.open100[0] > 0 && r.open100[0] < 1 && r.close100[0] > 0 && r.close100[0] < 1);
    await ctx.close();
  }
  await b.close(); srv.close(); console.log(out.join('\n')); process.exit(0); })();
