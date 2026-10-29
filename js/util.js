"use strict";
/* Utilidades genéricas (DOM, almacenamiento ligero, validación, formato).
   No saben nada de juegos ni de la interfaz concreta de la app. */

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

/** Crea un elemento: h("button", { class: "btn", onclick: fn }, "Texto", otroNodo). */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}

const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

/** localStorage que nunca lanza (modo privado, almacenamiento bloqueado…). */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  getJSON(k, fallback) { try { return JSON.parse(this.get(k)) ?? fallback; } catch { return fallback; } },
  setJSON(k, v) { this.set(k, JSON.stringify(v)); }
};

/* ---------- Validación ---------- */
const DATA_IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
/** Devuelve la URL si es http(s) o una imagen subida (data:) válida; si no, "". */
function safeUrl(u) {
  if (typeof u === "string" && u.startsWith("data:")) return u.length < 3e6 && DATA_IMG.test(u) ? u : "";
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; }
}
/** Horas jugadas: admite "12,5"; null si no es un número razonable. */
function cleanHours(v) {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 99999 ? n : null;
}

/* ---------- Texto y formato ---------- */
const stripAccents = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = t => stripAccents(t).replace(/[^a-z0-9]+/g, "-");
const initial = title => (title || "?").trim().charAt(0).toUpperCase();
const capitalize = t => t.charAt(0).toUpperCase() + t.slice(1);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const fmtRating = r => r == null ? "—" : Number.isInteger(r) ? String(r) : r.toFixed(1);
const fmtHours = n => n.toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " h";
const today = () => new Date().toISOString().slice(0, 10);
const cssUrl = u => `url("${u.replace(/"/g, "%22")}")`;

/** Descarga un Blob/File con el nombre indicado. */
function download(blob, name) {
  const a = h("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
