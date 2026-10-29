"use strict";
/* Arranque. */

// Sin zoom con pellizco (iOS Safari ignora user-scalable=no).
for (const type of ["gesturestart", "gesturechange"]) document.addEventListener(type, e => e.preventDefault());

(async () => {
  try { await DB.open(); games = await DB.all(); }
  catch { toast("No se pudo abrir el almacenamiento local", "error"); }
  history.replaceState({ tab: "home" }, "");
  render();
  initServiceWorker();
  navigator.storage?.persist?.().catch(() => {});   // pide que el navegador no borre los datos por falta de espacio
})();
