"use strict";
/* Ajustes: estadísticas, columnas, clave de RAWG, copia de seguridad y versión. */

function openSettings() {
  for (const mode of Object.keys(COLS_KEY)) $("#" + COLS_KEY[mode]).value = String(colsOf(mode));
  $("#apiKey").value = rawgKey();
  paintStats(); paintLastBackup();
  openDlg($("#dlgSet"));
  getVersion().then(v => { $("#ver").textContent = v ? "Versión " + v : ""; });
}
function paintStats() {
  const rated = games.filter(g => g.rating != null);
  const avg = rated.length ? rated.reduce((s, g) => s + g.rating, 0) / rated.length : null;
  const hours = Math.round(games.reduce((s, g) => s + (g.hours || 0), 0));
  $("#stats").replaceChildren(...[
    [games.length, "Total"], [inCat("played").length, "Jugados"],
    [avg == null ? "—" : avg.toFixed(1), "Nota media"], [hours.toLocaleString("es-ES"), "Horas totales"]
  ].map(([n, label]) => h("div", { class: "stat" }, h("b", {}, String(n)), h("span", {}, label))));
}

/* ---------- Copia de seguridad (JSON) ---------- */
function exportBackup() {
  const data = { app: "biblioteca", version: 1, exported: new Date().toISOString(), games };
  download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `biblioteca-${today()}.json`);
  markBackup();
  paintLastBackup();
  if (tab === "home") render();   // quita el recordatorio de Inicio
}
function paintLastBackup() {
  const t = lastBackupAt();
  $("#lastBackup").textContent = t
    ? "Última copia: " + new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) + "."
    : "Aún no has hecho ninguna copia.";
}

/* ---------- Recordatorio de copia en Inicio ---------- */
// Aparece si han pasado 30 días desde la última copia (o, si no hay ninguna, desde el primer juego añadido).
// "Más tarde" lo oculta una semana.
const BACKUP_EVERY_DAYS = 30, BACKUP_SNOOZE_DAYS = 7, DAY_MS = 864e5;
function backupDaysOverdue() {
  if (!games.length || Date.now() < backupSnoozedUntil()) return null;
  const since = lastBackupAt() || Math.min(...games.map(g => g.added || Date.now()));
  const days = Math.floor((Date.now() - since) / DAY_MS);
  return days >= BACKUP_EVERY_DAYS ? days : null;
}
function backupReminder() {
  const days = backupDaysOverdue(); if (days == null) return null;
  const text = lastBackupAt() ? `Hace ${days} días de tu última copia de seguridad.` : "Aún no has hecho ninguna copia de seguridad.";
  return h("div", { class: "bk-card", role: "status" },
    h("span", {}, h("b", {}, "Guarda una copia"), h("small", {}, text + " Si se borran los datos del navegador, perderías tu biblioteca.")),
    h("div", { class: "bk-btns" },
      h("button", { class: "btn small", onclick: () => { snoozeBackup(BACKUP_SNOOZE_DAYS * DAY_MS); render(); } }, "Más tarde"),
      h("button", { class: "btn small primary", onclick: exportBackup }, "Exportar")));
}
async function importBackup(file) {
  let list;
  try {
    const data = JSON.parse(await file.text());
    const raw = Array.isArray(data) ? data : data.games;   // admite el formato exportado o una lista suelta
    if (!Array.isArray(raw)) throw new Error();
    list = raw.map(sanitizeGame).filter(Boolean);
  } catch { toast("Archivo no válido", "error"); return; }
  if (!await ask({ title: "Importar copia", text: `Se reemplazarán tus ${games.length} juegos actuales por ${list.length} del archivo. ¿Continuar?`, ok: "Reemplazar", danger: true })) return;
  try { await DB.replaceAll(list); } catch { toast("No se pudo guardar la copia", "error"); return; }
  games = list;
  $("#dlgSet").close(); render(); toast("Importados " + list.length, "success");
}

/* ---------- Eventos ---------- */
for (const mode of Object.keys(COLS_KEY)) $("#" + COLS_KEY[mode]).addEventListener("change", e => { setCols(mode, e.target.value); render(); });
$("#btnSettings").addEventListener("click", openSettings);
$("#saveKey").addEventListener("click", () => { setRawgKey($("#apiKey").value.trim()); toast("Clave guardada", "success"); });
$("#exp").addEventListener("click", exportBackup);
$("#imp").addEventListener("click", () => $("#file").click());
$("#file").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) importBackup(f); });
