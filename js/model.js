"use strict";
/* Dominio: qué es un juego, en qué categorías está y las reglas que se aplican al cambiarlo.
   Forma de un juego (lo que se guarda en IndexedDB y se exporta):
   { id, title, year, platforms: "PC, Nintendo", avail: [plataformas según RAWG], cover: URL o data:,
     rawgId, status: backlog|playing|played, rating: 0–10 en pasos de 0,5, hours,
     playedY, playedM (cuándo lo jugaste; el mes es opcional), favorite,
     rank (posición manual en su estado), favRank (posición manual en Favoritos),
     added, updated, finished (marcas de tiempo) } */

const STATUS = [
  { id: "backlog", label: "Backlog" },
  { id: "playing", label: "Jugando" },
  { id: "played", label: "Jugados" }
];
const CATS = ["backlog", "playing", "played", "fav"];   // las tres de estado + Favoritos (transversal)
const isStatus = id => STATUS.some(s => s.id === id);
const catLabel = id => id === "fav" ? "Favoritos" : STATUS.find(s => s.id === id).label;
const inCat = cat => games.filter(g => cat === "fav" ? g.favorite : g.status === cat);
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const BASE_PLATFORMS = ["PC", "PlayStation", "Xbox", "Nintendo", "iOS", "Android", "Mac", "Linux", "Web"];
const splitPlatforms = str => String(str || "").split(",").map(x => x.trim()).filter(Boolean);

/* ---------- Cuándo lo jugaste ---------- */
/** Clave numérica para ordenar por fecha de juego (null si no tiene). */
const playedKey = g => g.playedY ? g.playedY * 12 + (g.playedM ? g.playedM - 1 : 0) : null;
const playedLabel = g => !g.playedY ? "" : (g.playedM ? MONTHS[g.playedM - 1].slice(0, 3) + " " : "") + g.playedY;
/** Al pasar a Jugados sin fecha se anotan el mes y el año actuales. */
function stampPlayed(g) {
  if (g.playedY) return;
  const d = new Date();
  g.playedY = d.getFullYear(); g.playedM = d.getMonth() + 1;
}

/* ---------- Orden manual ("Mi orden") ---------- */
const rankKey = cat => cat === "fav" ? "favRank" : "rank";
const byRank = key => (x, y) => (x[key] ?? 1e9) - (y[key] ?? 1e9) || y.updated - x.updated;
/** Coloca el juego al final de la lista (si la lista no tiene orden manual aún, se queda sin posición). */
function appendRank(g, key, list) {
  const ranks = list.filter(x => x.id !== g.id && x[key] != null).map(x => x[key]);
  g[key] = ranks.length ? Math.max(...ranks) + 1 : null;
}
/** Guarda un orden manual: la posición de cada juego pasa a ser su índice en la lista. */
function applyOrder(cat, ordered) {
  const key = rankKey(cat), puts = [];
  ordered.forEach((g, i) => { if (g[key] !== i) { g[key] = i; puts.push(DB.put(g)); } });
  return Promise.all(puts);
}

/* ---------- Ordenaciones ---------- */
const SORTS = {
  custom: "Mi orden",
  played: "Jugado: reciente",
  playedAsc: "Jugado: antiguo",
  rating: "Nota: más alta",
  ratingAsc: "Nota: más baja",
  hours: "Más horas"
};
/** Ordenaciones disponibles en cada categoría; la primera es la de por defecto. */
const SORTS_BY_CAT = {
  backlog: ["custom"],
  playing: ["custom"],
  played: ["played", "playedAsc", "rating", "ratingAsc", "hours"],
  fav: ["custom", "rating", "ratingAsc", "hours", "played", "playedAsc"]
};
const sortsFor = cat => SORTS_BY_CAT[cat].map(id => [id, SORTS[id]]);
/** Orden activo de una categoría: el elegido si sigue siendo válido; si no, el de por defecto. */
const effectiveSort = (cat = tab) => SORTS_BY_CAT[cat].includes(sortsSaved[cat]) ? sortsSaved[cat] : SORTS_BY_CAT[cat][0];
const byTitle = (x, y) => x.title.localeCompare(y.title, "es");
// Los juegos sin dato (nota, horas, fecha) van siempre al final; a igualdad, por título.
const COMPARE = {
  rating: (x, y) => (y.rating ?? -1) - (x.rating ?? -1) || byTitle(x, y),
  ratingAsc: (x, y) => (x.rating ?? 99) - (y.rating ?? 99) || byTitle(x, y),
  hours: (x, y) => (y.hours ?? -1) - (x.hours ?? -1) || byTitle(x, y),
  played: (x, y) => (playedKey(y) ?? -1) - (playedKey(x) ?? -1) || byTitle(x, y),
  playedAsc: (x, y) => (playedKey(x) ?? 1e9) - (playedKey(y) ?? 1e9) || byTitle(x, y)
};
const compareFor = cat => { const s = effectiveSort(cat); return s === "custom" ? byRank(rankKey(cat)) : COMPARE[s]; };
/** Juegos de una categoría en su orden actual (páginas de categoría y carruseles de Inicio). */
const sortedCat = cat => inCat(cat).sort(compareFor(cat));

/* ---------- Reglas al crear y cambiar juegos ---------- */
/** Juego nuevo para la categoría indicada (desde Inicio: Backlog), colocado al final de su lista. */
function createGame(fields, cat) {
  const now = Date.now();
  const g = {
    id: uid(), title: "", year: null, platforms: "", avail: [], cover: "", rawgId: null,
    status: isStatus(cat) ? cat : "backlog", rating: null, hours: null, playedY: null, playedM: null,
    favorite: cat === "fav", rank: null, favRank: null, added: now, updated: now, finished: null, ...fields
  };
  if (g.status === "played") stampPlayed(g);
  appendRank(g, "rank", inCat(g.status));
  if (g.favorite) appendRank(g, "favRank", inCat("fav"));
  return g;
}
/** Cambia el estado: al llegar a Jugados se anota cuándo; entra al final de su nueva categoría. */
function moveToStatus(g, status) {
  if (g.status === status) return false;
  g.status = status; g.updated = Date.now();
  if (status === "played") { g.finished ||= Date.now(); stampPlayed(g); }
  appendRank(g, "rank", inCat(status));
  return true;
}
/** Marca o desmarca como favorito; al marcarlo entra al final de Favoritos. */
function setFavorite(g, on) {
  if (!!g.favorite === on) return false;
  g.favorite = on; g.favRank = null;
  if (on) appendRank(g, "favRank", inCat("fav"));
  return true;
}
/** Mismo juego: mismo id de RAWG; si alguno no lo tiene, mismo título (sin tildes ni signos) y, si ambos tienen año, el mismo. */
const normTitle = t => stripAccents(t).replace(/[^a-z0-9]+/g, " ").trim();
function isSameGame(a, b) {
  if (a.rawgId != null && b.rawgId != null) return a.rawgId === b.rawgId;
  if (!normTitle(a.title) || normTitle(a.title) !== normTitle(b.title)) return false;
  return !(a.year && b.year && a.year !== b.year);
}

/* ---------- Importación ---------- */
const validYear = y => Number.isInteger(y) && y >= 1970 && y <= 2100;
/** Normaliza un juego de una copia de seguridad; null si no es válido. */
function sanitizeGame(g) {
  if (!g || typeof g.title !== "string" || !g.title.trim()) return null;
  return {
    id: String(g.id || uid()), title: g.title.trim(), year: Number.isFinite(g.year) ? g.year : null,
    platforms: String(g.platforms || ""),
    avail: Array.isArray(g.avail) ? g.avail.filter(x => typeof x === "string").slice(0, 20) : [],
    cover: safeUrl(g.cover || ""), rawgId: g.rawgId ?? null,
    status: isStatus(g.status) ? g.status : "backlog",
    rating: typeof g.rating === "number" && g.rating >= 0 && g.rating <= 10 ? g.rating : null,
    hours: g.hours == null ? null : cleanHours(g.hours),
    playedY: validYear(g.playedY) ? g.playedY : null,
    playedM: validYear(g.playedY) && Number.isInteger(g.playedM) && g.playedM >= 1 && g.playedM <= 12 ? g.playedM : null,
    favorite: !!g.favorite,
    rank: Number.isFinite(g.rank) ? g.rank : null, favRank: Number.isFinite(g.favRank) ? g.favRank : null,
    notes: String(g.notes || ""),   // ya no se editan, pero se conservan si venían de versiones anteriores
    added: g.added || Date.now(), updated: g.updated || Date.now(), finished: g.finished || null
  };
}
