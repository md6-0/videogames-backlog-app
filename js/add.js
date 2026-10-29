"use strict";
/* Añadir juego: búsqueda en RAWG o alta manual, con aviso si ya lo tienes. */

/** Categoría en la que se añade: la página actual o, desde Inicio, Backlog. */
const addTarget = () => CATS.includes(tab) ? tab : "backlog";
const inTarget = (g, cat) => cat === "fav" ? g.favorite : g.status === cat;

function openAdd() {
  const hasKey = !!rawgKey();
  $("#noKey").classList.toggle("hidden", hasKey);
  searchSeq++; $("#sq").disabled = !hasKey; $("#sgo").disabled = !hasKey; $("#sq").value = ""; $("#results").replaceChildren();
  openDlg($("#dlgAdd"));
  if (hasKey) setTimeout(() => $("#sq").focus(), 50);
}

async function addGame(fields) {
  if (!await resolveDuplicate(fields)) return;
  const g = createGame(fields, addTarget());
  await DB.put(g); games.push(g);
  $("#dlgAdd").close(); render(); openEdit(g.id, true);
}

/** Si ya tienes el juego, ofrece verlo o moverlo. Devuelve true solo si hay que crear uno nuevo. */
async function resolveDuplicate(fields) {
  const cat = addTarget(), dups = games.filter(g => isSameGame(g, fields));
  if (!dups.length) return true;
  const dup = dups.find(g => inTarget(g, cat)) || dups[0];
  if (inTarget(dup, cat)) {
    if (await ask({ title: "Ya lo tienes", text: `"${dup.title}" ya está en ${catLabel(cat)}.`, ok: "Ver el que tengo" })) { $("#dlgAdd").close(); openEdit(dup.id); }
    return false;
  }
  const where = dup.favorite && cat === "fav" ? "Favoritos" : catLabel(dup.status);
  const verb = cat === "fav" ? "Añadir a Favoritos" : "Moverlo a " + catLabel(cat);
  if (!await ask({ title: "Ya lo tienes", text: `"${dup.title}" ya está en ${where}.`, ok: verb })) return false;
  if (cat === "fav") setFavorite(dup, true); else moveToStatus(dup, cat);
  await DB.put(dup);
  $("#dlgAdd").close(); render();
  toast(cat === "fav" ? "Añadido a Favoritos" : "Movido a " + catLabel(cat), "success");
  return false;
}

/* ---------- Búsqueda (solo al pulsar Buscar o Intro; descarta respuestas antiguas) ---------- */
let searchSeq = 0;
async function search(q) {
  const seq = ++searchSeq, box = $("#results"), go = $("#sgo");
  go.disabled = true;
  box.replaceChildren(h("p", { class: "spin", role: "status" }, "Buscando…"));
  try {
    const found = await searchRawg(q, rawgKey());
    if (seq !== searchSeq) return;
    if (!found.length) { box.replaceChildren(h("p", { class: "note" }, "Sin resultados. Puedes añadirlo a mano.")); return; }
    box.replaceChildren(...found.map(g => h("button", { class: "res", onclick: () => addGame(g) }, coverEl(g),
      h("div", { class: "meta" }, h("div", { class: "title" }, g.title), h("div", { class: "sub" }, [g.year, g.avail.join(", ")].filter(Boolean).join(" · "))))));
  } catch (err) {
    if (seq === searchSeq) box.replaceChildren(h("p", { class: "note error" }, err.message));
  } finally {
    if (seq === searchSeq) go.disabled = !rawgKey();
  }
}

$("#fab").addEventListener("click", openAdd);
$("#goKey").addEventListener("click", () => { $("#dlgAdd").close(); openSettings(); });
$("#manual").addEventListener("click", () => addGame({ title: $("#sq").value.trim() }));
$("#sform").addEventListener("submit", e => {
  e.preventDefault();
  const q = $("#sq").value.trim();
  if (q.length < 2 || $("#sgo").disabled) return;
  $("#sq").blur();   // cierra el teclado para ver los resultados
  search(q);
});
// Al borrar el texto se vacía la lista; no se lanza ninguna petición mientras se escribe.
$("#sq").addEventListener("input", () => { if (!$("#sq").value.trim()) { searchSeq++; $("#sgo").disabled = !rawgKey(); $("#results").replaceChildren(); } });
