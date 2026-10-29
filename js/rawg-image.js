"use strict";
/* Compartido por la página y el service worker (sw.js lo carga con importScripts).
   RAWG sirve sus imágenes redimensionadas si se cambia /media/ por /media/resize/<ancho>/-/.
   A 1280 px de ancho pesan ~150 KB en lugar de varios MB y siguen viéndose nítidas. */
const RAWG_COVER_WIDTH = 1280;
const RAWG_MEDIA = /^(https:\/\/media\.rawg\.io\/media\/)(?!crop\/|resize\/)/;

/** URL de la versión reducida de una imagen de RAWG; cualquier otra URL se devuelve igual. */
const rawgSized = url => String(url).replace(RAWG_MEDIA, `$1resize/${RAWG_COVER_WIDTH}/-/`);
