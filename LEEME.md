# Mi Biblioteca de Videojuegos

App web instalable (PWA) para llevar tu lista de juegos: **Jugando**, **Jugados**, **Backlog** y **Favoritos**, con nota de 0 a 10 (pasos de 0,5), notas personales y portadas.

Los datos se guardan solo en el dispositivo (IndexedDB). No hay servidor ni cuenta.

## 1. Clave de RAWG (para buscar con portada)

1. Crea una cuenta gratuita en https://rawg.io/apidocs y copia tu clave.
2. En la app: engranaje → "Clave API de RAWG" → pegar → Guardar.

Sin clave la app funciona igual: añades juegos a mano (y puedes pegar una URL de portada).
RAWG exige citarlos como fuente (la app ya enlaza a rawg.io en el diálogo de búsqueda).

## 2. Publicarla (hace falta HTTPS para instalarla)

Opción rápida, GitHub Pages:

1. Crea un repositorio y sube estos archivos tal cual (en la raíz).
2. Settings → Pages → Deploy from a branch → `main` / root.
3. Abre `https://TU-USUARIO.github.io/NOMBRE-REPO/` en el móvil.

Vale cualquier hosting estático (Netlify, Cloudflare Pages…). Para probar en el PC: `python3 -m http.server` y abre `http://localhost:8000`.

## 3. Instalarla en el móvil

- Android (Chrome): menú ⋮ → "Instalar aplicación".
- iPhone (Safari): Compartir → "Añadir a pantalla de inicio".

Una vez instalada abre sin conexión; solo la búsqueda y las portadas necesitan internet.

## Copia de seguridad

Engranaje → Exportar genera un `.json`. Importar lo restaura (reemplaza lo actual).
**Los datos viven en el navegador del dispositivo**: si borras los datos del sitio o desinstalas, se pierden. Exporta de vez en cuando.
Cada instalación (móvil, PC) tiene su propia lista; para pasar datos de una a otra, exporta e importa.

## Archivos

- `index.html`: toda la app (HTML + CSS + JS, sin dependencias)
- `sw.js`: caché para uso sin conexión
- `manifest.webmanifest` + `icon-*.png`: instalación
