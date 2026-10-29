const VERSION = "v42";
const CACHE = "biblioteca-" + VERSION;
// Portadas: caché propia, sin versión, para que sobreviva a las actualizaciones de la app.
const COVERS = "biblioteca-portadas-2";
const MAX_COVERS = 800;
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

// Sin skipWaiting automático: la página avisa al usuario y es él quien decide cuándo activar la versión nueva.
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: "reload" }))))));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== COVERS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => {
  const d = e.data || {};
  if (d.type === "SKIP_WAITING") self.skipWaiting();
  if (d.type === "GET_VERSION" && e.ports[0]) e.ports[0].postMessage(VERSION);
});
// RAWG sirve la misma imagen a 1280 px de ancho cambiando /media/ por /media/resize/1280/-/ (mucho más ligera).
const small = u => u.replace(/^(https:\/\/media\.rawg\.io\/media\/)(?!crop\/|resize\/)/, "$1resize/1280/-/");
async function cover(req) {
  const c = await caches.open(COVERS);
  const hit = await c.match(req.url);
  if (hit) return hit;
  const sm = small(req.url);
  if (sm !== req.url) {
    try {
      const r = await fetch(sm, { mode: "cors", credentials: "omit" });
      if (r.ok) { c.put(req.url, r.clone()).catch(() => {}); return r; }
    } catch {}
  }
  // Se pide con CORS para guardar una respuesta normal (las opacas ocupan mucho más cupo). Si la web no lo permite, se sirve sin guardar.
  try {
    const r = await fetch(req.url, { mode: "cors", credentials: "omit" });
    if (r.ok) {
      c.put(req.url, r.clone()).then(async () => {
        const ks = await c.keys();
        for (const k of ks.slice(0, Math.max(0, ks.length - MAX_COVERS))) await c.delete(k);
      }).catch(() => {});
      return r;
    }
  } catch {}
  return fetch(req);
}
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method === "GET" && u.origin !== location.origin && e.request.destination === "image" && /^https?:$/.test(u.protocol)) { e.respondWith(cover(e.request)); return; }
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // RAWG (API): directo a red
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request).then(m => m || caches.match("./index.html")))
  );
});
