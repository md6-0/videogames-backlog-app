"use strict";
/* Cliente de la API de RAWG (https://rawg.io/apidocs): búsqueda de juegos con portada. */

/** Busca juegos y los devuelve con la forma de la app. Lanza Error con un mensaje para mostrar al usuario. */
async function searchRawg(query, key) {
  const url = `https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&search=${encodeURIComponent(query)}&page_size=12&search_precise=true`;
  let res;
  try { res = await fetch(url); }
  catch { throw new Error("No se pudo conectar con RAWG. Comprueba la conexión o añade el juego a mano."); }
  if (res.status === 401 || res.status === 403) throw new Error("Clave no válida. Revísala en Ajustes.");
  if (res.status === 429) throw new Error("Has agotado las peticiones de RAWG por este mes.");
  if (!res.ok) throw new Error("RAWG respondió con error " + res.status);
  const data = await res.json();
  return (data.results || []).map(x => ({
    title: x.name,
    year: x.released ? parseInt(x.released.slice(0, 4), 10) : null,
    avail: (x.parent_platforms || []).map(p => p.platform.name),   // plataformas en las que salió
    cover: safeUrl(x.background_image || ""),
    rawgId: x.id
  }));
}
