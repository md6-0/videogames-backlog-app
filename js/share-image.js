"use strict";
/* Imagen de la lista: dibuja la categoría actual (orden y filtro incluidos) en uno o varios PNG
   para compartir o descargar. Las páginas largas se trocean en imágenes de hasta 12 000 px. */

const IMG = { mode: "grid", items: [], label: "", blobs: [], urls: [], bmp: new Map(), seq: 0 };
const LAYOUT = { W: 1080, P: 40, HEAD: 170, MAXH: 12000, COLS: 4, GAP: 16, ROW_H: 200 };
const FONT = "system-ui, sans-serif";
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ratingHex = r => cssVar(r >= 8 ? "--good" : r >= 5 ? "--mid" : "--bad");

/* ---------- Portadas ---------- */
/** Descarga la portada como bitmap (null si la web de origen no permite usarla). */
async function loadCover(g) {
  const u = safeUrl(g.cover); if (!u) return null;
  if (IMG.bmp.has(g.id)) return IMG.bmp.get(g.id);
  let bmp = null;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const sized = rawgSized(u);
    let res = null;
    if (sized !== u) { try { res = await fetch(sized, { mode: "cors", signal: ctl.signal }); } catch { res = null; } }
    if (!res?.ok) res = await fetch(u, { mode: "cors", cache: "no-cache", signal: ctl.signal });
    if (res.ok) bmp = await createImageBitmap(await res.blob());
  } catch { bmp = null; }
  clearTimeout(timer);
  IMG.bmp.set(g.id, bmp);
  return bmp;
}
async function loadAllCovers(items) {
  let next = 0;   // 6 descargas en paralelo
  await Promise.all(Array.from({ length: 6 }, async () => { while (next < items.length) await loadCover(items[next++]); }));
}

/* ---------- Dibujo ---------- */
function roundRect(c, x, y, w, hh, r) {
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + hh, r); c.arcTo(x + w, y + hh, x, y + hh, r);
  c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function fitText(c, t, maxW) {
  if (c.measureText(t).width <= maxW) return t;
  while (t.length > 1 && c.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}
function wrapText(c, text, maxW, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean), lines = [];
  let cur = "", i = 0;
  for (; i < words.length; i++) {
    const next = cur ? cur + " " + words[i] : words[i];
    if (!cur || c.measureText(next).width <= maxW) cur = next;
    else { if (lines.length === maxLines - 1) break; lines.push(cur); cur = words[i]; }
  }
  lines.push(i < words.length ? cur + "…" : cur);
  return lines.map(l => fitText(c, l, maxW));
}
function drawCover(c, bmp, g, x, y, w, hh, r) {
  c.save(); roundRect(c, x, y, w, hh, r); c.clip();
  if (bmp) {
    const k = Math.max(w / bmp.width, hh / bmp.height), dw = bmp.width * k, dh = bmp.height * k;
    c.drawImage(bmp, x + (w - dw) / 2, y + (hh - dh) / 2, dw, dh);
  } else {
    c.fillStyle = cssVar("--surface2"); c.fillRect(x, y, w, hh);
    c.fillStyle = cssVar("--muted"); c.font = `700 ${Math.round(w * .4)}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(initial(g.title), x + w / 2, y + hh / 2);
  }
  c.restore();
}
function drawRating(c, r, x, y, w, hh, fs) {
  roundRect(c, x, y, w, hh, 8); c.fillStyle = ratingHex(r); c.fill();
  c.fillStyle = "#0b141d"; c.font = `800 ${fs}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(fmtRating(r), x + w / 2, y + hh / 2 + 1);
}
/** Sombra suave y filo claro: el mismo acabado de las tarjetas de la app. */
const CARD_R = 16;
function cardShadow(c, x, y, w, hh, fill) {
  c.save(); c.shadowColor = "rgba(0,0,0,.45)"; c.shadowBlur = 24; c.shadowOffsetY = 8;
  roundRect(c, x, y, w, hh, CARD_R); c.fillStyle = fill; c.fill(); c.restore();
}
function cardEdge(c, x, y, w, hh) {
  c.save(); roundRect(c, x + 1, y + 1, w - 2, hh - 2, CARD_R - 1); c.lineWidth = 2; c.strokeStyle = "rgba(255,255,255,.1)"; c.stroke(); c.restore();
}
function drawGridItem(c, g, x, y, cw, ch) {
  cardShadow(c, x, y, cw, ch, cssVar("--surface2"));
  drawCover(c, IMG.bmp.get(g.id) || null, g, x, y, cw, ch, CARD_R);
  c.save(); roundRect(c, x, y, cw, ch, CARD_R); c.clip();
  const shade = c.createLinearGradient(0, y + ch * .5, 0, y + ch);
  shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,.9)");
  c.fillStyle = shade; c.fillRect(x, y + ch * .5, cw, ch * .5); c.restore();
  c.fillStyle = "#fff"; c.font = `700 24px ${FONT}`; c.textAlign = "left"; c.textBaseline = "alphabetic";
  const lines = wrapText(c, g.title, cw - 24, 2);
  lines.forEach((l, k) => c.fillText(l, x + 12, y + ch - 14 - (lines.length - 1 - k) * 28));
  if (g.rating != null) drawRating(c, g.rating, x + cw - 62, y + 8, 54, 36, 22);
  cardEdge(c, x, y, cw, ch);
}
function drawListItem(c, g, y, colors) {
  const { W, P, ROW_H } = LAYOUT;
  cardShadow(c, P, y, W - 2 * P, ROW_H, colors.surface);
  drawCover(c, IMG.bmp.get(g.id) || null, g, P + 16, y + 16, 120, 168, 8);
  const tx = P + 160, maxW = W - P - 16 - (g.rating != null ? 104 : 0) - tx;
  c.textAlign = "left"; c.textBaseline = "alphabetic";
  c.fillStyle = colors.text; c.font = `700 34px ${FONT}`;
  const lines = wrapText(c, g.title, maxW, 2);
  lines.forEach((l, k) => c.fillText(l, tx, y + 56 + k * 40));
  let ty = y + 56 + (lines.length - 1) * 40 + 42;
  c.fillStyle = colors.muted; c.font = `500 26px ${FONT}`;
  const meta = [g.year, g.hours != null ? fmtHours(g.hours) : "", g.playedY ? "Jugado " + playedLabel(g) : "", tab === "fav" ? catLabel(g.status) : ""].filter(Boolean).join(" · ");
  if (meta) { c.fillText(fitText(c, meta, maxW), tx, ty); ty += 36; }
  if (g.platforms) c.fillText(fitText(c, g.platforms, maxW), tx, ty);
  if (g.rating != null) drawRating(c, g.rating, W - P - 16 - 88, y + 16, 88, 56, 32);
  cardEdge(c, P, y, W - 2 * P, ROW_H);
}
function drawPage(page, pageNo, pages, colors) {
  const { W, P, HEAD, COLS, GAP, ROW_H } = LAYOUT, grid = IMG.mode === "grid";
  const cw = Math.floor((W - 2 * P - GAP * (COLS - 1)) / COLS), ch = Math.round(cw * 1.4);
  const step = (grid ? ch : ROW_H) + GAP, perRow = grid ? COLS : 1, rows = Math.ceil(page.length / perRow);
  const cv = h("canvas", { width: W, height: HEAD + rows * step - GAP + P }), c = cv.getContext("2d");
  c.fillStyle = colors.bg; c.fillRect(0, 0, W, cv.height);
  c.fillStyle = colors.accent; c.fillRect(P, 52, 8, 76);
  c.textAlign = "left"; c.textBaseline = "alphabetic";
  c.fillStyle = colors.text; c.font = `800 60px ${FONT}`; c.fillText(IMG.label, P + 28, 100);
  c.fillStyle = colors.muted; c.font = `500 28px ${FONT}`;
  const date = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  c.fillText(`${plural(IMG.items.length, "juego", "juegos")} · ${date}` + (pages > 1 ? ` · ${pageNo}/${pages}` : ""), P + 28, 134);
  page.forEach((g, i) => {
    if (grid) drawGridItem(c, g, P + (i % COLS) * (cw + GAP), HEAD + Math.floor(i / COLS) * step, cw, ch);
    else drawListItem(c, g, HEAD + i * step, colors);
  });
  return cv;
}
/** Cuántos juegos caben en cada imagen sin pasar del alto máximo. */
function perPage() {
  const { W, P, HEAD, MAXH, COLS, GAP, ROW_H } = LAYOUT, grid = IMG.mode === "grid";
  const ch = Math.round(Math.floor((W - 2 * P - GAP * (COLS - 1)) / COLS) * 1.4);
  return Math.max(1, Math.floor((MAXH - HEAD - P + GAP) / ((grid ? ch : ROW_H) + GAP))) * (grid ? COLS : 1);
}

async function buildImages() {
  const seq = ++IMG.seq, items = IMG.items;
  resetImages();
  $("#imgNote").textContent = "Generando…";
  await loadAllCovers(items); if (seq !== IMG.seq) return;
  const colors = { bg: cssVar("--bg"), surface: cssVar("--surface"), text: cssVar("--text"), muted: cssVar("--muted"), accent: cssVar("--accent") };
  const size = perPage(), pages = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  for (let p = 0; p < pages.length; p++) {
    const cv = drawPage(pages[p], p + 1, pages.length, colors);
    const blob = await new Promise(r => cv.toBlob(r, "image/png")); cv.width = cv.height = 0;
    if (seq !== IMG.seq) return;
    if (!blob) { $("#imgNote").textContent = "No se pudo generar la imagen en este dispositivo."; return; }
    const url = URL.createObjectURL(blob);
    IMG.blobs.push(blob); IMG.urls.push(url);
    $("#imgPrev").append(h("img", { src: url, alt: `${IMG.label}, imagen ${p + 1} de ${pages.length}` }));
  }
  const failed = items.filter(g => safeUrl(g.cover) && !IMG.bmp.get(g.id));
  $("#imgNote").textContent = `${plural(items.length, "juego", "juegos")}, ${plural(pages.length, "imagen", "imágenes")}. Sigue el orden y el filtro actuales.` +
    (failed.length ? ` Sin portada en la imagen (la web de origen no lo permite o falló la descarga): ${failed.slice(0, 5).map(g => g.title).join(", ")}${failed.length > 5 ? ` y ${failed.length - 5} más` : ""}. En la ficha puedes subir la imagen desde el dispositivo.` : "");
}
function resetImages() {
  IMG.urls.forEach(u => URL.revokeObjectURL(u)); IMG.urls = []; IMG.blobs = [];
  $("#imgPrev").replaceChildren();
}
function imageFiles() {
  const base = `biblioteca-${slug(IMG.label)}-${today()}`, many = IMG.blobs.length > 1;
  return IMG.blobs.map((b, i) => new File([b], `${base}${many ? "-" + (i + 1) : ""}.png`, { type: "image/png" }));
}
function paintImgMode() { for (const b of $$("#imgMode button")) b.setAttribute("aria-pressed", String(b.dataset.m === IMG.mode)); }
const canShareFiles = () => typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "a.png", { type: "image/png" })] });

$("#btnImg").addEventListener("click", () => {
  const items = visible(); if (!items.length) { toast("No hay juegos que exportar", "warning"); return; }
  Object.assign(IMG, { items, label: catLabel(tab), mode: view === "list" ? "list" : "grid" });
  $("#imgHead").textContent = "Imagen · " + IMG.label; paintImgMode();
  $("#imgShare").classList.toggle("hidden", !canShareFiles());
  openDlg($("#dlgImg")); buildImages();
});
$("#imgMode").addEventListener("click", e => {
  const b = e.target.closest("button[data-m]");
  if (b && b.dataset.m !== IMG.mode) { IMG.mode = b.dataset.m; paintImgMode(); buildImages(); }
});
$("#imgDl").addEventListener("click", () => imageFiles().forEach((f, i) => setTimeout(() => download(f, f.name), i * 400)));
$("#imgShare").addEventListener("click", async () => {
  const files = imageFiles(); if (!files.length) return;
  try { await navigator.share({ files, title: "Mi Biblioteca · " + IMG.label }); }
  catch (e) { if (e?.name !== "AbortError") toast("No se pudo compartir; usa Descargar", "error"); }
});
$("#dlgImg").addEventListener("close", () => {
  IMG.seq++; resetImages();
  IMG.bmp.forEach(b => b?.close?.()); IMG.bmp.clear();
});
