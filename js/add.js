"use strict";
/* Añadir juego: búsqueda en RAWG o alta manual, con aviso si ya lo tienes. */

/** Categoría en la que se añade: la página actual o, desde Inicio, Backlog. */
const addTarget = () => CATS.includes(tab) ? tab : "backlog";
const inTarget = (g, cat) => cat === "fav" ? g.favorite : g.status === cat;

function openAdd() {
  const hasKey = !!rawgKey();
  $("#noKey").classList.toggle("hidden", hasKey);
  $("#sq").disabled = !hasKey; $("#sq").value = ""; $("#results").replaceChildren();
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

/* ---------- Búsqueda (con espera al teclear y descartando respuestas antiguas) ---------- */
let searchTimer = 0, searchSeq = 0;
async function search(q) {
  const seq = ++searchSeq, box = $("#results");
  box.replaceChildren(h("p", { class: "note" }, "Buscando…"));
  try {
    const found = await searchRawg(q, rawgKey());
    if (seq !== searchSeq) return;
    if (!found.length) { box.replaceChildren(h("p", { class: "note" }, "Sin resultados. Puedes añadirlo a mano.")); return; }
    box.replaceChildren(...found.map(g => h("button", { class: "res", onclick: () => addGame(g) }, coverEl(g),
      h("div", { class: "meta" }, h("div", { class: "title" }, g.title), h("div", { class: "sub" }, [g.year, g.avail.join(", ")].filter(Boolean).join(" · "))))));
  } catch (err) {
    if (seq === searchSeq) box.replaceChildren(h("p", { class: "note error" }, err.message));
  }
}

$("#fab").addEventListener("click", openAdd);
$("#goKey").addEventListener("click", () => { $("#dlgAdd").close(); openSettings(); });
$("#manual").addEventListener("click", () => addGame({ title: $("#sq").value.trim() }));
$("#sq").addEventListener("input", e => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { $("#results").replaceChildren(); return; }
  searchTimer = setTimeout(() => search(q), 350);
});
