"use strict";
/* Rewind: resumen de cada año con los juegos de Jugados que tienen año en "cuándo lo jugaste".
   El del año en curso no se abre hasta el 1 de diciembre; los anteriores, siempre. */

/* ---------- Datos ---------- */
const gamesOfYear = y => games.filter(g => g.status === "played" && g.playedY === y);
function rewindAvailable(y) {
  const now = new Date();
  return y < now.getFullYear() || (y === now.getFullYear() && now.getMonth() === 11);
}
/** Años con Rewind disponible, del más reciente al más antiguo. */
const rewindYears = () => [...new Set(games.filter(g => g.status === "played" && g.playedY).map(g => g.playedY))]
  .filter(rewindAvailable).sort((a, b) => b - a);
function rewindStats(list) {
  const hours = list.reduce((a, g) => a + (g.hours || 0), 0), rated = list.filter(g => g.rating != null);
  return { count: list.length, hours, avg: rated.length ? rated.reduce((a, g) => a + g.rating, 0) / rated.length : null };
}
const summary = st => plural(st.count, "juego", "juegos") + (st.hours ? " · " + fmtHours(st.hours) : "");

/* ---------- Tarjeta de Inicio (solo el año en curso, desde diciembre) ---------- */
function rewindCard() {
  const y = new Date().getFullYear();
  if (!rewindYears().includes(y)) return null;
  return h("button", { class: "rw-card", onclick: () => openRewind(y), "aria-label": `Ver el Rewind de ${y}` },
    h("span", {}, h("b", {}, `Rewind ${y}`), h("small", {}, summary(rewindStats(gamesOfYear(y))))),
    h("span", { class: "cat-go", "aria-hidden": "true" }, "›"));
}

/* ---------- Panel ---------- */
const MEDALS = ["🥇", "🥈", "🥉"];
const CONFETTI = ["#ffd166", "#ff6ec7", "#66c0f4", "#b88cff", "#a4d007"];
const thumb = g => paintCover(h("span", { class: "th" }), g);
const heading = text => h("h3", { class: "rw-h" }, text);
const podium = (list, value) => list.map((g, i) =>
  h("div", { class: "rw-row" }, h("span", { class: "med", "aria-hidden": "true" }, MEDALS[i] || ""), thumb(g), h("span", { class: "n" }, g.title), value(g)));

function totalsSection(st) {
  const box = (icon, value, label) => h("div", {}, h("em", {}, icon), h("b", {}, value), h("small", {}, label));
  return [h("div", { class: "rw-tot" },
    box("🎮", String(st.count), st.count === 1 ? "juego" : "juegos"),
    box("⏱️", st.hours ? fmtHours(st.hours) : "—", "horas"),
    box("⭐", st.avg == null ? "—" : fmtRating(Math.round(st.avg * 10) / 10), "nota media"))];
}
function bestSection(list) {
  const best = list.filter(g => g.rating != null).sort((a, b) => b.rating - a.rating || (b.hours || 0) - (a.hours || 0)).slice(0, 3);
  return best.length ? [heading("Los mejor valorados"), ...podium(best, g => ratingTag(g.rating, "tag"))] : null;
}
function longestSection(list) {
  const long = list.filter(g => g.hours).sort((a, b) => b.hours - a.hours).slice(0, 3);
  return long.length ? [heading("Los más jugados"), ...podium(long, g => h("span", { class: "v" }, fmtHours(g.hours)))] : null;
}
function monthsSection(list) {
  const per = Array(12).fill(0); let noMonth = 0;
  for (const g of list) if (g.playedM) per[g.playedM - 1]++; else noMonth++;
  const max = Math.max(1, ...per);
  return [heading("Por mes"),
    h("div", { class: "rw-months" }, ...per.map((n, i) => h("div", { title: `${MONTHS[i]}: ${n}` },
      n ? h("em", {}, String(n)) : null,
      h("i", { class: n && n === max ? "top" : "", style: `height:${Math.round(n / max * 90)}px;opacity:${n ? 1 : .25}` }),
      MONTHS[i].slice(0, 3)))),
    noMonth ? h("p", { class: "note" }, `${noMonth} sin mes indicado.`) : null];
}
function platformsSection(list) {
  const count = new Map();
  for (const g of list) for (const p of splitPlatforms(g.platforms)) count.set(p, (count.get(p) || 0) + 1);
  const rows = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!rows.length) return null;
  const max = rows[0][1], none = list.filter(g => !splitPlatforms(g.platforms).length).length;
  return [heading("Plataformas"),
    ...rows.map(([p, n]) => h("div", { class: "rw-bar" }, h("span", {}, p), h("i", { style: `width:${Math.max(4, Math.round(n / max * 100))}px` }), h("span", {}, String(n)))),
    none ? h("p", { class: "note" }, `${none} sin plataforma indicada.`) : null];
}
function calendarSection(list) {
  const byMonth = [...list].sort((a, b) => (a.playedM || 13) - (b.playedM || 13) || byTitle(a, b));
  const out = [heading("Tu calendario de juegos")]; let last = -1;
  for (const g of byMonth) {
    const m = g.playedM || 0;
    if (m !== last) { last = m; out.push(h("h4", { class: "rw-m" }, m ? capitalize(MONTHS[m - 1]) : "Sin mes")); }
    out.push(h("div", { class: "rw-row" }, thumb(g), h("span", { class: "n" }, g.title),
      g.hours != null ? h("span", { class: "hrs" }, fmtHours(g.hours)) : null,
      g.rating != null ? ratingTag(g.rating, "tag") : null));
  }
  return out;
}

function paintRewind() {
  const y = parseInt($("#rwYear").value, 10), list = gamesOfYear(y);
  $("#rwYearBig").textContent = String(y);
  const sections = [totalsSection(rewindStats(list)), bestSection(list), longestSection(list), monthsSection(list), platformsSection(list), calendarSection(list)].filter(Boolean);
  // Cada sección entra un poco después que la anterior.
  $("#rwBody").replaceChildren(...sections.map((kids, i) => h("div", { class: "rw-sec", style: `animation-delay:${i * 70}ms` }, ...kids)));
  $("#rwConf").replaceChildren(...Array.from({ length: 22 }, (_, i) => h("i", {
    style: `left:${(i * 47) % 100}%;background:${CONFETTI[i % CONFETTI.length]};animation-delay:${-(i * 0.37) % 5}s;animation-duration:${4 + (i % 4)}s`
  })));
}
/** Abre el Rewind del año indicado (o el más reciente disponible). */
function openRewind(year) {
  const years = rewindYears(); if (!years.length) return;
  $("#rwYear").replaceChildren(...years.map(v => h("option", { value: String(v) }, String(v))));
  $("#rwYear").value = String(years.includes(year) ? year : years[0]);
  paintRewind(); openDlg($("#dlgRew"));
}
$("#rwYear").addEventListener("change", paintRewind);
$("#btnRew").addEventListener("click", () => openRewind());
