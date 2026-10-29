"use strict";
/* Versiones nuevas. El service worker no se activa solo: se avisa arriba y el usuario decide cuándo actualizar,
   para no recargar la app mientras edita un juego. */

let swReg = null, swPending = null, swReloading = false;

function offerUpdate(worker) {
  swPending = worker;
  const u = $("#upd");
  u.classList.remove("hidden", "enter"); void u.offsetWidth; u.classList.add("enter");
  placeUpd();
}
/** Versión del service worker que controla la página (null si no hay). */
function getVersion() {
  const ctrl = "serviceWorker" in navigator && navigator.serviceWorker.controller;
  if (!ctrl) return Promise.resolve(null);
  return new Promise(resolve => {
    const ch = new MessageChannel();
    ch.port1.onmessage = e => resolve(e.data);
    ctrl.postMessage({ type: "GET_VERSION" }, [ch.port2]);
    setTimeout(() => resolve(null), 1500);
  });
}
function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").then(reg => {
    swReg = reg;
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offerUpdate(w); });
    });
    // Se busca versión nueva al volver a la app y cada media hora.
    const check = () => reg.update().catch(() => {});
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    setInterval(check, 30 * 60 * 1000);
  }).catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (swReloading) location.reload(); });
}

$("#updGo").addEventListener("click", () => {
  if ($("#dlgEdit").open || $("#dlgAdd").open) { toast("Guarda o cierra la ficha y vuelve a pulsar", "warning"); return; }
  const w = swPending || swReg?.waiting;
  if (!w) { $("#upd").classList.add("hidden"); return; }
  swReloading = true; w.postMessage({ type: "SKIP_WAITING" });
});
$("#updX").addEventListener("click", () => $("#upd").classList.add("hidden"));
$("#upd").addEventListener("animationend", e => e.currentTarget.classList.remove("enter"));
// Mientras el aviso está visible la página baja para que no tape la cabecera.
new ResizeObserver(() => document.documentElement.style.setProperty("--upd-h", $("#upd").offsetHeight + "px")).observe($("#upd"));
$("#chk").addEventListener("click", async () => {
  if (!swReg) { toast("Las actualizaciones no están disponibles aquí", "info"); return; }
  try { await swReg.update(); } catch { toast("No se pudo comprobar. ¿Sin conexión?", "warning"); return; }
  if (swReg.waiting) { offerUpdate(swReg.waiting); $("#dlgSet").close(); }
  else if (swReg.installing) toast("Descargando la versión nueva…", "info");
  else toast("Ya tienes la última versión", "success");
});
