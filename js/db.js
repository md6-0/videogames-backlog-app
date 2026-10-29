"use strict";
/* Persistencia: IndexedDB, base "biblioteca", almacén "games" (clave: id).
   Todo el estado vive en el dispositivo; no hay servidor. */
const DB = (() => {
  let db;
  const open = () => new Promise((resolve, reject) => {
    const req = indexedDB.open("biblioteca", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("games", { keyPath: "id" });
    req.onsuccess = () => { db = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  });
  const tx = (mode, fn) => new Promise((resolve, reject) => {
    const t = db.transaction("games", mode);
    const out = fn(t.objectStore("games"));
    t.oncomplete = () => resolve(out && out.result);
    t.onerror = () => reject(t.error);
  });
  return {
    open,
    all: () => tx("readonly", s => s.getAll()),
    put: g => tx("readwrite", s => s.put(g)),
    del: id => tx("readwrite", s => s.delete(id)),
    replaceAll: list => tx("readwrite", s => { s.clear(); list.forEach(g => s.put(g)); })
  };
})();
