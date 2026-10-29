# Mi Biblioteca de Videojuegos

App web instalable (PWA) para llevar el control de tus videojuegos desde el móvil: lo que quieres jugar, lo que estás jugando, lo que ya has jugado y tus favoritos. Funciona sin conexión, no tiene cuentas ni servidor y **los datos se quedan en tu dispositivo**.

Versión **1.0.0**.

---

## Funcionalidades

**Categorías**
- **Backlog**, **Jugando** y **Jugados** (cada juego está en una) y **Favoritos** (cualquier juego puede ser favorito además de su estado).
- **Inicio** muestra un carrusel por categoría, en el mismo orden que su página.

**Juegos**
- Búsqueda en [RAWG](https://rawg.io) con portada, año y plataformas, o alta a mano.
- Aviso si el juego ya está en tu biblioteca: te ofrece abrir el que tienes o moverlo a la categoría en la que lo añades.
- Ficha con plataformas en las que lo has jugado, estado, nota de 0 a 10 (en pasos de 0,5), mes y año en que lo jugaste, horas y favorito.
- Al pasar un juego a Jugados se anotan el mes y el año actuales (se pueden cambiar).
- Portada propia: por URL o subiendo una imagen desde el dispositivo.
- En los juegos que vienen de RAWG, el título y el año no se editan y aparecen sobre la portada.

**Orden y vista**
- Backlog y Jugando: *Mi orden*, que se cambia arrastrando.
- Jugados: jugado reciente (por defecto) o antiguo, nota más alta o más baja y más horas.
- Favoritos: *Mi orden* (por defecto) y las mismas opciones que Jugados.
- Cada categoría recuerda su orden.
- Vista de lista o de cuadrícula, con número de columnas configurable.
- En Inicio se puede arrastrar un juego a otra fila para cambiarlo de categoría o añadirlo a Favoritos.

**Rewind**
- Resumen anual de los juegos de Jugados con año: totales, los mejor valorados, los más jugados, juegos por mes, plataformas y calendario.
- El del año en curso se abre a partir del 1 de diciembre; los anteriores, desde el botón del reloj de la cabecera.

**Otros**
- Imagen de la lista actual (cuadrícula o lista) para compartir o descargar.
- Copia de seguridad: exportar e importar en JSON.
- Aviso cuando hay una versión nueva; se actualiza cuando tú decides.
- Diseño adaptado a móvil, tablet (vertical y horizontal) y escritorio.

---

## Uso

### Clave de RAWG (opcional)

Para buscar juegos con portada hace falta una clave gratuita:

1. Crea una cuenta en [rawg.io/apidocs](https://rawg.io/apidocs) y copia tu clave.
2. En la app: **engranaje → Búsqueda de portadas → pega la clave → Guardar**.

Sin clave la app funciona igual: los juegos se añaden a mano.

### Instalarla en el móvil

La app necesita HTTPS para instalarse (GitHub Pages, Netlify, Cloudflare Pages…).

- **Android (Chrome):** menú ⋮ → *Instalar aplicación*.
- **iPhone (Safari):** Compartir → *Añadir a pantalla de inicio*.

Una vez instalada abre sin conexión. Solo la búsqueda y las portadas que aún no se han visto necesitan internet.

### Tus datos

- Se guardan en el navegador del dispositivo (IndexedDB). Cada instalación tiene su propia biblioteca.
- **Si borras los datos del sitio o desinstalas la app, se pierden.** Exporta una copia de vez en cuando (**engranaje → Datos → Exportar**).
- Para pasar la biblioteca a otro dispositivo, exporta en uno e importa en el otro. Importar **reemplaza** lo que haya.

---

## Desarrollo

No hay dependencias ni paso de compilación: son archivos estáticos.

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

El service worker solo funciona en `localhost` o con HTTPS.

### Publicar con GitHub Pages

*Settings → Pages → Deploy from a branch → `main` / raíz*. La app queda en `https://<usuario>.github.io/<repositorio>/`.

### Publicar una versión nueva

1. Haz los cambios.
2. **Sube `VERSION` en `sw.js`** (por ejemplo, `1.0.0` → `1.0.1`). Sin este cambio el navegador no detecta la versión nueva y los usuarios no reciben el aviso.
3. Si has creado o renombrado algún archivo, añádelo a `SHELL` en `sw.js` para que funcione sin conexión.
4. Publica. Al abrir la app aparecerá el aviso *Hay una versión nueva*.

---

## Arquitectura

### Estructura

```
index.html            Marcado de la app y de sus paneles (sin estilos ni lógica en línea)
sw.js                 Service worker: caché de la app, caché de portadas y versión
manifest.webmanifest  Datos para instalarla
icon-*.png            Iconos

css/
  app.css             Estilos: tokens → base → estructura → componentes → paneles → movimiento → responsive
  rewind.css          Estilo festivo del Rewind (el único apartado con estilo propio)

js/                   En orden de carga:
  rawg-image.js       URL de portadas de RAWG en tamaño reducido (compartido con sw.js)
  util.js             Utilidades genéricas: DOM, localStorage, validación, formato
  db.js               Persistencia en IndexedDB
  state.js            Estado en memoria y preferencias guardadas
  model.js            Dominio: categorías, ordenaciones y reglas al crear y cambiar juegos
  ui.js               Piezas de interfaz: avisos, paneles, confirmación, portadas, notas
  views.js            Navegación, Inicio y páginas de categoría
  edit.js             Ficha del juego
  rawg.js             Cliente de la API de RAWG
  add.js              Añadir juego (búsqueda, alta manual, duplicados)
  rewind.js           Rewind anual
  share-image.js      Imagen de la lista (canvas → PNG)
  settings.js         Ajustes y copia de seguridad
  drag.js             Arrastrar y soltar (reordenar y mover entre filas de Inicio)
  updates.js          Registro del service worker y aviso de versión nueva
  main.js             Arranque
```

### Capas

Cada archivo solo usa lo definido en archivos anteriores, salvo las llamadas entre funciones que ocurren en tiempo de ejecución (por ejemplo, la vista llama a `openEdit` al tocar un juego).

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Base | `util`, `db` | Sin conocimiento de juegos ni de la interfaz |
| Estado y dominio | `state`, `model` | Datos y reglas, sin tocar el DOM. Las reglas viven solo aquí: `createGame`, `moveToStatus`, `setFavorite`, `applyOrder`, `isSameGame`, `sanitizeGame` |
| Interfaz | `ui`, `views` | Componentes reutilizables y render de pantallas a partir del estado |
| Funcionalidades | `edit`, `add`, `rewind`, `share-image`, `settings`, `drag`, `updates` | Cada una con su panel y sus eventos |
| Arranque | `main` | Abre la base de datos, pinta y registra el service worker |

### Decisiones

- **Sin framework ni compilación.** La app es pequeña y así se puede publicar en cualquier hosting estático y abrir sin herramientas.
- **Scripts clásicos con `defer`, no módulos ES.** Comparten el ámbito global y se cargan en el orden de `index.html`. Es una elección pragmática para evitar un paso de compilación. El coste es que no hay aislamiento entre archivos: los nombres globales tienen que ser únicos. Si la app crece, el siguiente paso natural sería pasar a módulos ES (`type="module"` con `import`/`export`).
- **Render declarativo sencillo.** Cada cambio de estado llama a `render()`, que vuelve a pintar la pantalla actual. Con cientos de juegos va sobrado y evita estados intermedios incoherentes.
- **IndexedDB es la fuente de verdad.** Al arrancar se copia a memoria (`games`) y cada cambio se escribe en los dos sitios.
- **Actualizaciones bajo control del usuario.** El service worker nuevo espera hasta que se pulsa *Actualizar*, para no recargar la app mientras editas un juego.
- **Portadas en caché aparte.** Se guardan en el dispositivo (hasta 800) en una caché que no se borra al actualizar la app. Las de RAWG se piden a 1280 px de ancho.

### Modelo de datos

Cada juego se guarda así (también en la copia de seguridad):

| Campo | Descripción |
|---|---|
| `id` | Identificador único |
| `title`, `year` | Título y año de lanzamiento |
| `rawgId`, `avail` | Id en RAWG y plataformas en las que salió (vacíos si se añadió a mano) |
| `platforms` | Plataformas en las que lo has jugado (`"PC, Nintendo"`) |
| `cover` | URL de la portada o imagen subida (`data:image/jpeg;base64,…`) |
| `status` | `backlog`, `playing` o `played` |
| `favorite` | Si está en Favoritos |
| `rating` | Nota de 0 a 10, en pasos de 0,5 (o `null`) |
| `hours` | Horas jugadas (o `null`) |
| `playedY`, `playedM` | Año y mes en que lo jugaste (el mes es opcional) |
| `rank`, `favRank` | Posición manual en su categoría y en Favoritos |
| `added`, `updated`, `finished` | Marcas de tiempo |

Preferencias en `localStorage`: `view`, `sorts`, `colsList`, `colsGrid` y `rawgKey`.

### Ampliar la app

- **Una ordenación nueva:** añade su nombre en `SORTS` y su comparador en `COMPARE` (`model.js`), y su id en `SORTS_BY_CAT` en las categorías donde tenga sentido.
- **Un campo nuevo en los juegos:** dale valor por defecto en `createGame`, valídalo en `sanitizeGame` (para la importación) y añádelo a la ficha (`index.html` + `edit.js`).
- **Un archivo nuevo:** añádelo a `index.html` en el lugar que le toque según sus dependencias y a `SHELL` en `sw.js`.

---

## Créditos

Datos e imágenes de juegos de [RAWG](https://rawg.io). La app lo cita en el panel de búsqueda, como pide su API.
