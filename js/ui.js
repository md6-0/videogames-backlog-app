"use strict";
/* Piezas de interfaz reutilizables: avisos, paneles, confirmación, portadas, notas y corazones. */

/* ---------- Avisos (toasts) ---------- */
const TOAST_ICON = { success: "✓", warning: "!", error: "✕", info: "i" };
function toast(msg, type = "info") {
  if (!TOAST_ICON[type]) type = "info";
  const t = h("div", { class: "toast t-" + type, role: type === "error" ? "alert" : "status" },
    h("span", { class: "ti", "aria-hidden": "true" }, TOAST_ICON[type]), h("span", { class: "tm" }, msg));
  // Los <dialog> modales viven en la capa superior: el aviso entra en esa capa como popover para verse encima.
  if (typeof t.showPopover === "function") { t.setAttribute("popover", "manual"); document.body.append(t); try { t.showPopover(); } catch {} }
  else document.body.append(t);
  setTimeout(() => t.classList.add("out"), 2200);
  setTimeout(() => t.remove(), 2400);
}

/* ---------- Paneles ---------- */
// Un panel modal tapa todo lo demás, así que el aviso de versión nueva se mueve dentro del panel de arriba
// (y vuelve al body al cerrarlo).
let dlgStack = [];
function placeUpd() {
  dlgStack = dlgStack.filter(d => d.open);
  const host = dlgStack[dlgStack.length - 1] || document.body, upd = $("#upd");
  if (upd.parentNode !== host) host.append(upd);
}
function openDlg(d) {
  if (!d.open) d.showModal();
  dlgStack = dlgStack.filter(x => x !== d); dlgStack.push(d);
  placeUpd();
}
document.addEventListener("click", e => { const c = e.target.closest("[data-close]"); if (c) c.closest("dialog").close(); });
for (const d of $$("dialog")) {
  d.addEventListener("click", e => { if (e.target === d) d.close(); });   // tocar el fondo cierra
  d.addEventListener("close", placeUpd);
}

/** Confirmación en un panel propio (sin confirm() del navegador). Resuelve "ok" o false. */
function ask({ title, text, ok = "Aceptar", danger = false }) {
  return new Promise(resolve => {
    const d = $("#dlgAsk");
    $("#askTitle").textContent = title; $("#askText").textContent = text;
    const yes = $("#askYes"); yes.textContent = ok; yes.className = "btn " + (danger ? "danger" : "primary");
    d.returnValue = "";
    d.addEventListener("close", () => resolve(d.returnValue || false), { once: true });
    openDlg(d);
  });
}
$("#askYes").addEventListener("click", () => { const d = $("#dlgAsk"); d.returnValue = "ok"; d.close(); });
$("#askNo").addEventListener("click", () => $("#dlgAsk").close());

/** Control segmentado: un botón por opción; onPick recibe el id elegido. */
function segmented(container, options, value, onPick) {
  container.replaceChildren(...options.map(o => h("button", {
    type: "button", "aria-pressed": String(o.id === value),
    onclick: () => { onPick(o.id); segmented(container, options, o.id, onPick); }
  }, o.label)));
}

/* ---------- Elementos de juego ---------- */
const ratingColor = r => r >= 8 ? "var(--good)" : r >= 5 ? "var(--mid)" : "var(--bad)";
/** Etiqueta de nota coloreada (cls "chip" sobre portadas, "tag" en listas). */
function ratingTag(r, cls = "chip") {
  const t = h("span", { class: cls }, fmtRating(r));
  t.style.background = ratingColor(r);
  return t;
}
/** Pone la portada como fondo del elemento o, si no hay, la inicial del título (fallback personaliza cómo se muestra). */
function paintCover(el, g, fallback = letter => letter) {
  const u = safeUrl(g.cover);
  if (u) el.style.backgroundImage = cssUrl(u);
  else el.append(fallback(initial(g.title)));
  return el;
}
const coverEl = (g, cls = "cover") => paintCover(h("div", { class: cls }), g);

// Corazón vectorial: el carácter ♥ de la fuente sale alto y estrecho.
const heartSvg = on => `<svg viewBox="0 0 26 22" aria-hidden="true"><path d="M13 20.5S1.8 13.7 1.8 7.2C1.8 4 4.2 1.8 7.1 1.8c2.4 0 4.6 1.4 5.9 3.7 1.3-2.3 3.5-3.7 5.9-3.7 2.9 0 5.3 2.2 5.3 5.4 0 6.5-11.2 13.3-11.2 13.3z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
function heartEl(cls, on) {
  const e = h("span", { class: cls, "aria-hidden": "true" });
  e.innerHTML = heartSvg(on);
  return e;
}
