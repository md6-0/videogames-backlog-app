"use strict";
/* Arrastrar y soltar con eventos de puntero.
   Ratón: se arrastra directamente. Táctil: mantener pulsado (350 ms) y mover; si el dedo se mueve antes,
   es un desplazamiento normal de la página. Mientras se arrastra, la página se desplaza sola cerca de los bordes. */

const DRAG_HOLD_MS = 350, DRAG_SLOP_PX = 8;
let lastPointer = "mouse";
addEventListener("pointerdown", e => { lastPointer = e.pointerType; }, true);

/**
 * Controlador genérico. Opciones:
 *  root        contenedor que recibe los eventos
 *  enabled()   si se puede empezar a arrastrar ahora
 *  itemOf(n)   elemento arrastrable que contiene al nodo n (o null)
 *  place(st)   mueve el hueco (st.ph) según la posición del puntero (st.x, st.y)
 *  drop(st, save) aplica el cambio con el hueco aún en su sitio; puede devolver una función para después del render
 *  onStart(st), onEnd(st), autoScroll(st) → true si ha desplazado algo   (opcionales)
 */
function createDragController(o) {
  let st = null, suppressClick = false;

  function end() {
    if (!st) return;
    clearTimeout(st.timer); cancelAnimationFrame(st.raf);
    removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", cancel);
    o.onEnd?.(st);
    st = null;
  }
  function activate() {
    if (!st || st.active) return;
    clearTimeout(st.timer); st.active = true;
    const el = st.el, r = el.getBoundingClientRect();
    st.ph = h("div", { class: "ph", "aria-hidden": "true" });
    st.ph.style.width = r.width + "px"; st.ph.style.height = r.height + "px";
    el.before(st.ph);
    st.ox = st.x - r.left; st.oy = st.y - r.top; st.css = el.getAttribute("style") || "";
    Object.assign(el.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", margin: "0", zIndex: "30", flex: "none" });
    el.classList.add("dragging");
    o.onStart?.(st);
    try { navigator.vibrate?.(12); } catch {}
    st.raf = requestAnimationFrame(tick);
  }
  function tick() {
    if (!st?.active) return;
    const nav = $("#tabs").getBoundingClientRect();   // barra inferior: su borde superior; barra lateral: el de la pantalla
    const top = $("header").getBoundingClientRect().bottom + 24, bottom = (nav.width > innerWidth / 2 ? nav.top : innerHeight) - 24;
    let v = 0;
    if (st.y < top) v = -Math.min(16, (top - st.y) / 4 + 2);
    else if (st.y > bottom) v = Math.min(16, (st.y - bottom) / 4 + 2);
    if (v) scrollBy(0, v);
    if (o.autoScroll?.(st) || v) o.place(st);
    st.raf = requestAnimationFrame(tick);
  }
  function finish(save) {
    const { el, ph, css } = st;
    const after = o.drop(st, save);
    el.classList.remove("dragging");
    if (css) el.setAttribute("style", css); else el.removeAttribute("style");
    ph.remove();
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 400);   // el clic que sigue al soltar no abre la ficha
    end(); render();
    after?.();
  }
  function move(e) {
    if (!st || e.pointerId !== st.id) return;
    st.x = e.clientX; st.y = e.clientY;
    const far = Math.hypot(st.x - st.x0, st.y - st.y0) > DRAG_SLOP_PX;
    if (!st.active) { if (far) { if (st.type === "mouse") activate(); else end(); } return; }
    if (far) st.moved = true;
    st.el.style.left = (st.x - st.ox) + "px"; st.el.style.top = (st.y - st.oy) + "px";
    o.place(st);
  }
  function up(e) { if (st && e.pointerId === st.id) { if (st.active) finish(st.moved); else end(); } }
  function cancel(e) { if (st && e.pointerId === st.id) { if (st.active) finish(false); else end(); } }

  o.root.addEventListener("pointerdown", e => {
    if (st || (e.pointerType === "mouse" && e.button !== 0) || !o.enabled()) return;
    const el = o.itemOf(e.target); if (!el || !o.root.contains(el)) return;
    st = { el, id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false, moved: false, timer: 0, raf: 0 };
    if (e.pointerType !== "mouse") st.timer = setTimeout(activate, DRAG_HOLD_MS);
    addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", cancel);
  });
  addEventListener("touchmove", e => { if (st?.active) e.preventDefault(); }, { passive: false });
  o.root.addEventListener("click", e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  // Al mantener pulsado con el dedo no debe salir el menú nativo del navegador.
  o.root.addEventListener("contextmenu", e => { if (o.itemOf(e.target) && (lastPointer !== "mouse" || st?.active)) e.preventDefault(); });
}

/* ---------- Páginas de categoría: reordenar con "Mi orden" (sin filtro) ---------- */
(() => {
  const list = $("#list");
  const itemOf = n => n?.closest?.(".card,.tile") ?? null;
  createDragController({
    root: list, itemOf,
    enabled: () => tab !== "home" && effectiveSort() === "custom" && !filter.trim(),
    place(st) {
      const target = document.elementsFromPoint(st.x, st.y).map(itemOf).find(n => n && n !== st.el && list.contains(n));
      if (!target) return;
      if (st.ph.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) target.after(st.ph); else target.before(st.ph);
    },
    drop(st, save) {
      if (!save) return;
      st.ph.replaceWith(st.el);
      const byId = new Map(games.map(g => [g.id, g]));
      const ordered = [...list.querySelectorAll(".card,.tile")].map(x => byId.get(x.dataset.id)).filter(Boolean);
      applyOrder(tab, ordered).catch(() => toast("No se pudo guardar el orden", "error"));
    }
  });
})();

/* ---------- Inicio: llevar un juego a otra fila (cambia de estado o entra en Favoritos) o reordenar ---------- */
(() => {
  const box = $("#home");
  const tileOf = n => n?.closest?.(".strip .tile:not(.more)") ?? null;
  const strips = () => box.querySelectorAll(".strip");

  function highlight(st, cat) {
    if (st.cat === cat) return;
    st.cat?.classList.remove("drop");
    st.cat = cat; cat?.classList.add("drop");
  }
  // Durante el arrastre las filas solo crecen: si el hueco sale de una fila con un único juego, las de debajo no suben bajo el dedo.
  function lockHeights() { for (const s of strips()) s.style.minHeight = Math.max(parseFloat(s.style.minHeight) || 0, s.offsetHeight) + "px"; }
  function appendTo(strip, ph) { const more = strip.querySelector(".tile.more"); if (more) more.before(ph); else strip.append(ph); }
  function placeAt(st) {
    const under = document.elementsFromPoint(st.x, st.y).filter(n => n !== st.el && !st.el.contains(n));   // sin la tarjeta flotante
    const cat = under.map(n => n.closest?.(".cat")).find(Boolean);
    if (!cat) { st.over = null; highlight(st, null); return; }
    highlight(st, cat);
    const strip = cat.querySelector(".strip"); st.over = strip;
    const empty = strip.querySelector(".cat-empty"); if (empty) empty.style.display = "none";
    const target = under.map(tileOf).find(n => n && n !== st.el && strip.contains(n));
    if (target) {
      if (st.ph.parentNode === strip) { if (st.ph.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) target.after(st.ph); else target.before(st.ph); }
      else { const r = target.getBoundingClientRect(); if (st.x < r.left + r.width / 2) target.before(st.ph); else target.after(st.ph); }
      return;
    }
    const tiles = [...strip.querySelectorAll(".tile:not(.more):not(.dragging)")], last = tiles[tiles.length - 1];
    if (!tiles.length || st.x > last.getBoundingClientRect().right) {
      const next = st.ph.nextElementSibling;
      if (st.ph.parentNode !== strip || (next && !next.classList.contains("more"))) appendTo(strip, st.ph);
    } else if (st.ph.parentNode !== strip) {
      (tiles.find(n => { const r = n.getBoundingClientRect(); return r.left + r.width / 2 > st.x; }) || last).before(st.ph);
    }
  }
  /** Aplica el cambio: estado o favorito, y posición dentro de la fila de destino. */
  function applyDrop(id, cat, index) {
    const g = games.find(x => x.id === id); if (!g) return null;
    const changed = cat === "fav" ? setFavorite(g, true) : moveToStatus(g, cat);
    const ordered = inCat(cat).filter(x => x.id !== g.id).sort(byRank(rankKey(cat)));
    ordered.splice(Math.min(Math.max(index, 0), ordered.length), 0, g);
    const saved = Promise.all([applyOrder(cat, ordered), changed ? DB.put(g) : null]);
    return () => {
      if (changed) toast(cat === "fav" ? "Añadido a Favoritos" : "Movido a " + catLabel(cat), "success");
      saved.catch(() => toast("No se pudo guardar el cambio", "error"));
    };
  }

  createDragController({
    root: box, itemOf: tileOf,
    enabled: () => tab === "home",
    onStart(st) {
      document.body.classList.add("dnd");
      lockHeights(); st.over = st.el.closest(".strip"); highlight(st, st.el.closest(".cat"));
    },
    onEnd(st) {
      document.body.classList.remove("dnd"); highlight(st, null);
      for (const s of strips()) s.style.minHeight = "";
    },
    place(st) { placeAt(st); lockHeights(); },
    autoScroll(st) {   // desplaza la fila hacia los lados cerca de sus bordes
      if (!st.over) return false;
      const r = st.over.getBoundingClientRect();
      if (st.x < r.left + 40) { st.over.scrollLeft -= 12; return true; }
      if (st.x > r.right - 40) { st.over.scrollLeft += 12; return true; }
      return false;
    },
    drop(st, save) {
      const strip = st.ph.parentNode;
      if (!save || !st.over || !strip?.classList?.contains("strip")) return;
      const index = [...strip.querySelectorAll(".tile:not(.more):not(.dragging), .ph")].indexOf(st.ph);
      return applyDrop(st.el.dataset.id, strip.dataset.cat, index);
    }
  });
})();
