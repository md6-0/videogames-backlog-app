"use strict";
/* Estado de la app en memoria y preferencias guardadas en el dispositivo. */

let games = [];        // copia en memoria de todos los juegos (IndexedDB es la fuente de verdad al arrancar)
let tab = "home";      // pantalla actual: "home" o una categoría (backlog, playing, played, fav)
let filter = "";       // texto del filtro de la página de categoría
let view = store.get("view") === "grid" ? "grid" : "list";

const setView = v => { view = v; store.set("view", v); };

/* Orden elegido en cada categoría: { played: "rating", fav: "custom", … } */
let sortsSaved = store.getJSON("sorts", {});
const setSort = (cat, sortId) => { sortsSaved = { ...sortsSaved, [cat]: sortId }; store.setJSON("sorts", sortsSaved); };

/* Columnas de las páginas de categoría (0 = automático, según el ancho). */
const COLS_KEY = { list: "colsList", grid: "colsGrid" };
const colsOf = mode => { const v = parseInt(store.get(COLS_KEY[mode]), 10); return v >= 1 && v <= 8 ? v : 0; };
const setCols = (mode, n) => store.set(COLS_KEY[mode], String(n));

/* Clave de la API de RAWG (opcional: sin ella se añaden juegos a mano). */
const rawgKey = () => store.get("rawgKey") || "";
const setRawgKey = k => store.set("rawgKey", k);

/* Copias de seguridad: cuándo se hizo la última y hasta cuándo se ha pospuesto el recordatorio. */
const lastBackupAt = () => Number(store.get("lastBackup")) || 0;
const backupSnoozedUntil = () => Number(store.get("backupSnooze")) || 0;
const markBackup = () => store.set("lastBackup", String(Date.now()));
const snoozeBackup = ms => store.set("backupSnooze", String(Date.now() + ms));
