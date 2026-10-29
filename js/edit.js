"use strict";
/* Ficha del juego: ver y editar todos sus datos. Los cambios se aplican al pulsar Guardar. */

let editing = null;   // borrador del juego abierto (copia; el original no cambia hasta guardar)
const NO_URL = "URL: https://…", UPLOADED = "Imagen subida desde el dispositivo";

function openEdit(id, isNew = false) {
  const g = games.find(x => x.id === id); if (!g) return;
  editing = { ...g, plats: splitPlatforms(g.platforms) };
  $("#editHead").textContent = isNew ? "Nuevo juego" : "Editar juego";
  // Juegos de RAWG: título y año fijos, escritos sobre la portada. Juegos manuales: editables.
  $("#dlgEdit .hero").classList.toggle("api", g.rawgId != null);
  $("#eCapT").textContent = g.title; $("#eCapY").textContent = g.year || "";
  $("#eTitle").value = g.title; $("#eYear").value = g.year || "";
  $("#eHours").value = g.hours ?? "";
  const uploaded = (g.cover || "").startsWith("data:");
  $("#eCoverUrl").value = uploaded ? "" : g.cover || ""; $("#eCoverUrl").placeholder = uploaded ? UPLOADED : NO_URL;
  fillPlayed(g.playedY, g.playedM);
  segmented($("#eStatus"), STATUS, g.status, pickStatus);
  paintEditCover(); paintPlatforms(); paintRating(); paintFav();
  openDlg($("#dlgEdit"));
}

/* ---------- Partes de la ficha ---------- */
function paintEditCover() { const c = coverEl(editing); c.id = "eCover"; $("#eCover").replaceWith(c); }
function paintPlatforms() {
  // Las plataformas que RAWG dice que tiene el juego (o una lista base) y las ya marcadas.
  const options = [...new Set([...(editing.avail?.length ? editing.avail : BASE_PLATFORMS), ...editing.plats])];
  $("#ePlats").replaceChildren(...options.map(p => h("button", {
    type: "button", "aria-pressed": String(editing.plats.includes(p)),
    onclick: () => { editing.plats = editing.plats.includes(p) ? editing.plats.filter(x => x !== p) : [...editing.plats, p]; paintPlatforms(); }
  }, p)));
}
function paintRating() {
  const r = editing.rating;
  $("#eBig").textContent = fmtRating(r);
  $("#eBig").style.color = r == null ? "var(--muted)" : ratingColor(r);
  $("#eRange").value = r ?? 5;
  $("#eRange").style.opacity = r == null ? ".4" : "1";
}
function paintFav() {
  const b = $("#eFav"), on = editing.favorite;
  b.setAttribute("aria-pressed", String(on));
  b.replaceChildren(heartEl("hbtn", on), on ? "En favoritos" : "Añadir a favoritos");
  b.style.color = on ? "var(--accent)" : "";
}
/** Selectores de mes y año (el mes solo se puede elegir si hay año). */
function fillPlayed(y, m) {
  const ys = $("#ePlayedY"), ms = $("#ePlayedM"), now = new Date().getFullYear();
  const years = []; for (let i = now + 1; i >= 1980; i--) years.push(i);
  if (y && !years.includes(y)) years.push(y);
  ys.replaceChildren(h("option", { value: "" }, "Año"), ...years.map(v => h("option", { value: String(v) }, String(v))));
  ms.replaceChildren(h("option", { value: "" }, "Mes"), ...MONTHS.map((n, i) => h("option", { value: String(i + 1) }, capitalize(n))));
  ys.value = y ? String(y) : ""; ms.value = y && m ? String(m) : ""; ms.disabled = !y;
}
function pickStatus(status) {
  const was = editing.status; editing.status = status;
  // Al marcarlo como jugado se propone el mes actual (se puede cambiar antes de guardar).
  if (status === "played" && was !== "played" && !$("#ePlayedY").value) { const d = new Date(); fillPlayed(d.getFullYear(), d.getMonth() + 1); }
}

/* ---------- Eventos ---------- */
$("#eRange").addEventListener("input", e => { editing.rating = parseFloat(e.target.value); paintRating(); });
$("#eClear").addEventListener("click", () => { editing.rating = null; paintRating(); });
$("#eFav").addEventListener("click", () => { editing.favorite = !editing.favorite; paintFav(); });
$("#ePlayedY").addEventListener("change", e => { const has = !!e.target.value; $("#ePlayedM").disabled = !has; if (!has) $("#ePlayedM").value = ""; });
$("#eCoverPick").addEventListener("click", () => $("#eCoverFile").click());
$("#eCoverClear").addEventListener("click", () => { editing.cover = ""; $("#eCoverUrl").value = ""; $("#eCoverUrl").placeholder = NO_URL; paintEditCover(); });
$("#eCoverUrl").addEventListener("change", e => { editing.cover = safeUrl(e.target.value); paintEditCover(); });
$("#eCoverFile").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = ""; if (!file) return;
  try {
    editing.cover = await imageToDataUrl(file, 600);
    $("#eCoverUrl").value = ""; $("#eCoverUrl").placeholder = UPLOADED; paintEditCover();
  } catch { toast("No se pudo leer esa imagen", "error"); }
});
/** Reduce la imagen (lado mayor ≤ max px) y la guarda como JPEG embebido: así sale siempre al exportar. */
async function imageToDataUrl(file, max) {
  const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = h("canvas", { width: Math.max(1, Math.round(bmp.width * k)), height: Math.max(1, Math.round(bmp.height * k)) });
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close?.();
  const url = cv.toDataURL("image/jpeg", 0.85);
  if (!safeUrl(url)) throw new Error("imagen no válida");
  return url;
}

$("#eSave").addEventListener("click", async () => {
  const orig = games.find(x => x.id === editing.id); if (!orig) return;
  const title = $("#eTitle").value.trim();
  if (!title) { $("#eTitle").focus(); toast("Pon un título", "warning"); return; }
  const hoursRaw = $("#eHours").value.trim(), hours = hoursRaw === "" ? null : cleanHours(hoursRaw);
  if (hoursRaw !== "" && hours == null) { $("#eHours").focus(); toast("Horas no válidas", "warning"); return; }
  const year = parseInt($("#eYear").value, 10), py = parseInt($("#ePlayedY").value, 10), pm = parseInt($("#ePlayedM").value, 10);

  const g = {
    ...orig, title, hours, year: Number.isFinite(year) ? year : null,
    platforms: editing.plats.join(", "), rating: editing.rating,
    cover: safeUrl($("#eCoverUrl").value) || editing.cover || "",
    playedY: Number.isFinite(py) ? py : null, playedM: Number.isFinite(py) && Number.isFinite(pm) ? pm : null,
    updated: Date.now()
  };
  moveToStatus(g, editing.status);
  setFavorite(g, !!editing.favorite);
  if (g.status === "played") g.finished ||= Date.now();

  await DB.put(g);
  games[games.indexOf(orig)] = g;
  $("#dlgEdit").close();
  // Si estabas en una categoría de estado y el juego cambia de estado, se va con él.
  if (isStatus(tab) && tab !== g.status) { tab = g.status; history.replaceState({ tab }, ""); }
  render(); toast("Guardado", "success");
});
$("#eDel").addEventListener("click", async () => {
  const g = editing;
  await DB.del(g.id);
  games = games.filter(x => x.id !== g.id);
  $("#dlgEdit").close(); render();
  toast(`"${g.title}" eliminado`, "success", { action: { label: "Deshacer", run: () => restoreGame(g) } });
});
/** Devuelve un juego eliminado con todos sus datos y su posición en el orden manual. */
async function restoreGame(g) {
  if (games.some(x => x.id === g.id)) return;
  await DB.put(g); games.push(g); render();
  toast("Juego recuperado", "success");
}

