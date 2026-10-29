"use strict";
/* Pantallas: navegación, Inicio (carruseles) y páginas de categoría (lista o cuadrícula). */

const NAV_ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  backlog: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  playing: '<path d="M6 4l14 8-14 8z"/>',
  played: '<path d="M20 6L9 17l-5-5"/>',
  fav: '<path d="M12 21s-7-4.4-9.3-9A5.3 5.3 0 0 1 12 6a5.3 5.3 0 0 1 9.3 6c-2.3 4.6-9.3 9-9.3 9z"/>'
};
const EMPTY_MSG = {
  backlog: ["Backlog vacío", "Apunta aquí lo que quieres jugar."],
  playing: ["Nada en marcha", "Pulsa + para añadir lo que estás jugando."],
  played: ["Aún no has terminado ninguno", "Aquí irán tus juegos jugados, con su nota."],
  fav: ["Sin favoritos", "Marca un juego con el corazón y aparecerá aquí."]
};
const HOME_MAX = 12;   // portadas por carrusel; el resto, en "Ver todos"

/* ---------- Navegación (con historial, para que el botón atrás funcione) ---------- */
function showTab(id) {
  tab = id; filter = ""; $("#q").value = "";
  render(); pageEnter();
}
function go(id) {
  if (id === tab) { scrollTo(0, 0); return; }
  history.pushState({ tab: id }, "");
  showTab(id); scrollTo(0, 0);
}
addEventListener("popstate", e => { const id = e.state?.tab || "home"; if (id !== tab) showTab(id); });
function pageEnter() { const m = $("main"); m.classList.remove("enter"); void m.offsetWidth; m.classList.add("enter"); }

/* ---------- Elementos ---------- */
/** Portada vertical (carruseles y cuadrícula). */
function tileEl(g, showFav) {
  const t = paintCover(h("button", { class: "tile", "data-id": g.id, "aria-label": g.title, onclick: () => openEdit(g.id) }), g);
  if (g.rating != null) t.append(ratingTag(g.rating));
  if (showFav && g.favorite) t.append(heartEl("hrt", true));
  t.append(h("div", { class: "cap" }, h("b", {}, g.title), g.hours != null ? h("i", {}, fmtHours(g.hours)) : null));
  return t;
}
/** Tarjeta horizontal (modo lista). */
function cardEl(g, inFav) {
  const sub = [g.year, g.platforms, g.hours != null ? fmtHours(g.hours) : "", g.playedY ? "Jugado " + playedLabel(g) : ""].filter(Boolean).join(" · ");
  const c = paintCover(h("button", { class: "card", "data-id": g.id, "aria-label": g.title, onclick: () => openEdit(g.id) }), g,
    letter => h("span", { class: "initial" }, letter));
  if (inFav) c.append(h("span", { class: "pill" }, catLabel(g.status)));
  if (g.rating != null) c.append(ratingTag(g.rating));
  const heart = heartEl("heart" + (g.favorite ? " on" : ""), g.favorite);
  heart.addEventListener("click", e => { e.stopPropagation(); toggleFavorite(g); });   // el corazón no abre la ficha
  c.append(h("div", { class: "body" }, h("div", { class: "title" }, g.title), sub ? h("div", { class: "sub" }, sub) : null), heart);
  return c;
}
/** Añade o quita un juego de Favoritos desde el corazón de su tarjeta. El aviso permite deshacerlo. */
async function toggleFavorite(g) {
  const before = { favorite: g.favorite, favRank: g.favRank, updated: g.updated };
  setFavorite(g, !g.favorite); g.updated = Date.now();
  await DB.put(g); render();
  toast(g.favorite ? "Añadido a favoritos" : "Quitado de favoritos", "success", {
    action: { label: "Deshacer", run: async () => { Object.assign(g, before); await DB.put(g); render(); } } });
}
function navIcon(id) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const attrs = { viewBox: "0 0 24 24", fill: id === "fav" && tab === "fav" ? "currentColor" : "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  svg.innerHTML = NAV_ICONS[id];
  return svg;
}

/* ---------- Render ---------- */
/** Juegos de la página actual: su categoría, en su orden y con el filtro aplicado. */
function visible() {
  const f = filter.trim().toLowerCase();
  return sortedCat(tab).filter(g => !f || (g.title + " " + (g.platforms || "")).toLowerCase().includes(f));
}
function renderNav() {
  $("#tabs").replaceChildren(...[["home", "Inicio"], ...CATS.map(id => [id, catLabel(id)])].map(([id, label]) =>
    h("button", { role: "tab", "aria-selected": String(tab === id), onclick: () => go(id) }, navIcon(id), h("span", {}, label))));
}
function renderHeader() {
  const home = tab === "home";
  $("#ttl").replaceChildren(home ? "Mi Biblioteca" : catLabel(tab), home ? "" : h("small", {}, " " + inCat(tab).length));
  $("#tools").classList.toggle("hidden", home);
  $("#vt").classList.toggle("hidden", home);
  $("#btnImg").classList.toggle("hidden", home);
  $("#btnRew").classList.toggle("hidden", !home || !rewindYears().length);   // solo en Inicio
  for (const b of $$("#vt button")) b.setAttribute("aria-pressed", String(b.dataset.v === view));
  if (home) return;
  const sorts = sortsFor(tab), sel = $("#sort");
  sel.replaceChildren(...sorts.map(([v, l]) => h("option", { value: v }, l)));
  sel.value = effectiveSort();
  sel.classList.toggle("hidden", sorts.length < 2);   // Backlog y Jugando solo tienen "Mi orden"
}
function renderHome() {
  const box = $("#home");
  if (!games.length) { box.replaceChildren(h("div", { class: "empty" }, h("b", {}, "Tu biblioteca está vacía"), "Pulsa + para añadir tu primer juego.")); return; }
  box.replaceChildren(backupReminder() ?? "", rewindCard() ?? "", ...CATS.map(id => {
    const items = sortedCat(id);
    const strip = h("div", { class: "strip", "data-cat": id }, ...items.slice(0, HOME_MAX).map(g => tileEl(g, id !== "fav")));
    if (!items.length) strip.append(h("p", { class: "cat-empty" }, EMPTY_MSG[id][1]));
    if (items.length > HOME_MAX) strip.append(h("button", { class: "tile more", onclick: () => go(id) }, `Ver todos (${items.length})`));
    return h("section", { class: "cat", "aria-label": catLabel(id) },
      h("button", { class: "cat-h", onclick: () => go(id), "aria-label": `Ver ${catLabel(id)}` },
        h("span", { class: "cat-t" }, catLabel(id)), h("span", { class: "cat-n" }, String(items.length)), h("span", { class: "cat-go", "aria-hidden": "true" }, "›")),
      stripScroller(strip));
  }));
}
/** Envuelve un carrusel con flechas para desplazarlo con el ratón (solo se ven con puntero fino). */
function stripScroller(strip) {
  const wrap = h("div", { class: "strip-wrap" }, strip);
  const go = dir => h("button", { class: "strip-nav " + (dir < 0 ? "prev" : "next"), type: "button", tabindex: "-1", "aria-hidden": "true",
    onclick: () => strip.scrollBy({ left: dir * Math.max(200, strip.clientWidth * .8), behavior: "smooth" }) }, dir < 0 ? "‹" : "›");
  wrap.append(go(-1), go(1));
  const update = () => {
    wrap.classList.toggle("can-prev", strip.scrollLeft > 4);
    wrap.classList.toggle("can-next", strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4);
  };
  strip.addEventListener("scroll", update, { passive: true });
  new ResizeObserver(update).observe(strip);
  return wrap;
}
function renderList() {
  const list = $("#list"), cols = colsOf(view);
  const sortable = effectiveSort() === "custom" && !filter.trim();
  list.className = "list" + (view === "grid" ? " grid" : "") + (sortable ? " sortable" : "") + (cols ? " cols" : "");
  if (cols) list.style.setProperty("--cols", cols); else list.style.removeProperty("--cols");
  const items = visible();
  if (!items.length) {
    const [title, hint] = filter ? ["Sin resultados", "Prueba con otro filtro."] : EMPTY_MSG[tab];
    list.replaceChildren(h("div", { class: "empty" }, h("b", {}, title), hint));
    return;
  }
  list.replaceChildren(...items.map(g => view === "grid" ? tileEl(g, tab !== "fav") : cardEl(g, tab === "fav")));
}
/** Vuelve a pintar la pantalla actual a partir del estado. */
function render() {
  const home = tab === "home";
  renderNav(); renderHeader();
  $("#home").classList.toggle("hidden", !home);
  $("#list").classList.toggle("hidden", home);
  if (home) renderHome(); else renderList();
}

/* ---------- Controles de la cabecera ---------- */
$("#q").addEventListener("input", e => { filter = e.target.value; render(); });
$("#sort").addEventListener("change", e => { setSort(tab, e.target.value); render(); });
$("#vt").addEventListener("click", e => {
  const b = e.target.closest("button[data-v]");
  if (b && b.dataset.v !== view) { setView(b.dataset.v); render(); }
});
