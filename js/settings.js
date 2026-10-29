"use strict";
/* Ajustes: estadísticas, columnas, clave de RAWG, copia de seguridad y versión. */

function openSettings() {
  for (const mode of Object.keys(COLS_KEY)) $("#" + COLS_KEY[mode]).value = String(colsOf(mode));
  $("#apiKey").value = rawgKey();
  paintStats();
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
