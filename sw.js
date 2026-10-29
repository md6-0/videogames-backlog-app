/* Service worker: la app funciona sin conexión y las portadas se guardan en el dispositivo.
   Al publicar una versión nueva hay que cambiar VERSION: así el navegador detecta el cambio y la app avisa. */
importScripts("js/rawg-image.js");   // rawgSized()

const VERSION = "1.5.0";
const CACHE = "biblioteca-" + VERSION;          // la app (se renueva con cada versión)
const COVERS = "biblioteca-portadas-2";         // portadas (sobrevive a las actualizaciones)
const MAX_COVERS = 800;
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png",
  "./css/app.css", "./css/rewind.css",
  "./js/rawg-image.js", "./js/util.js", "./js/db.js", "./js/state.js", "./js/model.js", "./js/ui.js", "./js/views.js",
  "./js/edit.js", "./js/rawg.js", "./js/add.js", "./js/rewind.js", "./js/share-image.js", "./js/settings.js",
  "./js/drag.js", "./js/foil.js", "./js/updates.js", "./js/main.js"
];

// Sin skipWaiting automático: la página avisa y el usuario decide cuándo activar la versión nueva.
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: "reload" }))))));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== COVERS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("message", e => {
  const msg = e.data || {};
  if (msg.type === "SKIP_WAITING") self.skipWaiting();
  if (msg.type === "GET_VERSION" && e.ports[0]) e.ports[0].postMessage(VERSION);
});

/* Portadas: primero la caché; si no está, se descarga (de RAWG, en tamaño reducido) y se guarda.
   Se piden con CORS para guardar respuestas normales (las opacas ocupan mucho más cupo);
   si la web de origen no lo permite, la imagen se muestra pero no se guarda. */
async function trimCovers(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_COVERS))) await cache.delete(k);
}
async function fetchCors(url) {
  try { const r = await fetch(url, { mode: "cors", credentials: "omit" }); return r.ok ? r : null; } catch { return null; }
}
async function cover(req) {
  const cache = await caches.open(COVERS);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  const sized = rawgSized(req.url);
  const res = (sized !== req.url && await fetchCors(sized)) || await fetchCors(req.url);
  if (res) { cache.put(req.url, res.clone()).then(() => trimCovers(cache)).catch(() => {}); return res; }
  return fetch(req);
}

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.origin !== location.origin) {
    if (req.destination === "image" && /^https?:$/.test(url.protocol)) e.respondWith(cover(req));
    return;   // la API de RAWG va directa a la red
  }
  // La app: red primero (para recibir cambios) y caché si no hay conexión.
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(m => m || caches.match("./index.html")))
  );
});
