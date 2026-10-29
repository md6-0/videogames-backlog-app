"use strict";
/* Efecto "cromo": al pasar el ratón por una portada o una tarjeta se inclina hacia el puntero y brilla con reflejos,
   como los cromos con foil de Steam. Solo con ratón: en pantallas táctiles no hay "pasar por encima",
   y se respeta la preferencia de movimiento reducido. El aspecto está en .foil (css/app.css). */

const FOIL_TILT = 9;   // grados máximos de inclinación
const FOIL_VARS = ["--rx", "--ry", "--mx", "--my"];
let foilEl = null, foilFrame = 0;

const foilAllowed = () =>
  matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches &&
  !document.body.classList.contains("dnd");   // no mientras se arrastra

function foilOff() {
  cancelAnimationFrame(foilFrame);
  if (!foilEl) return;
  foilEl.classList.remove("foil");
  for (const v of FOIL_VARS) foilEl.style.removeProperty(v);
  foilEl = null;
}
function foilMove(e) {
  if (e.pointerType !== "mouse" || !foilAllowed()) { foilOff(); return; }
  const el = e.target.closest?.(".tile:not(.more), .card") ?? null;
  if (el !== foilEl) { foilOff(); foilEl = el; }
  if (!el) return;
  cancelAnimationFrame(foilFrame);
  foilFrame = requestAnimationFrame(() => {
    if (foilEl !== el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.classList.add("foil");
    el.style.setProperty("--ry", ((x - .5) * 2 * FOIL_TILT).toFixed(2) + "deg");
    el.style.setProperty("--rx", ((.5 - y) * 2 * FOIL_TILT).toFixed(2) + "deg");
    el.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
    el.style.setProperty("--my", (y * 100).toFixed(1) + "%");
  });
}
document.addEventListener("pointermove", foilMove, { passive: true });
document.addEventListener("pointerdown", foilOff, { passive: true });          // al pulsar o empezar a arrastrar
document.addEventListener("scroll", foilOff, { capture: true, passive: true }); // el elemento bajo el puntero cambia sin moverlo
document.documentElement.addEventListener("pointerleave", foilOff);
