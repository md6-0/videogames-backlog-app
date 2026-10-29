# Mi Biblioteca de Videojuegos

Una app para el móvil donde apuntar los videojuegos que quieres jugar, los que estás jugando y los que ya has terminado, con tu nota, las horas que les has dedicado y cuándo los jugaste. Al final de cada año prepara un resumen, el *Rewind*, con lo mejor de ese año.

Es una aplicación web que se instala en el móvil como cualquier otra app. Funciona sin conexión, no pide cuenta ni registro y todo lo que apuntas se queda en tu dispositivo: no hay ningún servidor detrás.

---

## Qué puedes hacer

### Organizar tus juegos

La biblioteca se reparte en tres listas según el momento en que está cada juego: **Backlog** (los que tienes pendientes), **Jugando** y **Jugados**. Aparte está **Favoritos**, donde aparece cualquier juego que marques con el corazón, esté en la lista que esté.

La pantalla de **Inicio** muestra una fila por lista, como en una tienda de juegos. Si mantienes pulsado un juego y lo arrastras a otra fila, cambia de lista. Así, por ejemplo, pasas un juego de Jugando a Jugados sin entrar en su ficha.

### Añadir juegos

El botón **+** abre un buscador conectado a [RAWG](https://rawg.io), una base de datos pública de videojuegos. Escribes el nombre, eliges el resultado y el juego entra con su portada, su año y las plataformas en las que salió. Si prefieres no usar RAWG, o el juego no aparece, puedes añadirlo a mano.

La app avisa si intentas añadir un juego que ya tienes. Por ejemplo, si lo añades a Jugando y ya estaba en el Backlog, te ofrece moverlo en vez de duplicarlo.

### La ficha de cada juego

Al tocar un juego se abre su ficha, con todo lo que puedes apuntar:

- las plataformas en las que lo has jugado,
- en qué lista está,
- tu nota, de 0 a 10 en pasos de medio punto,
- el mes y el año en que lo jugaste,
- las horas que le has dedicado,
- y si es uno de tus favoritos.

Cuando un juego pasa a Jugados, la app apunta sola el mes y el año actuales, y puedes cambiarlos si no es correcto. También puedes cambiar la portada, pegando la dirección de una imagen o subiendo una foto desde el móvil.

### Ordenar y ver las listas

En Backlog y Jugando el orden lo decides tú arrastrando los juegos, porque suelen ser listas cortas que quieres priorizar a tu manera.

En Jugados puedes ordenar por fecha (por defecto, los jugados más recientemente arriba), por nota o por horas. Favoritos tiene esas mismas opciones y además tu propio orden, que es el que aparece de inicio.

Cada lista recuerda el orden que elegiste, y las filas de Inicio usan ese mismo orden. Las listas se pueden ver como tarjetas o como cuadrícula de portadas, con el número de columnas que prefieras.

### El Rewind

Cada año tiene su resumen: cuántos juegos terminaste y cuántas horas jugaste, tus tres juegos mejor valorados y los tres a los que más horas dedicaste. También verás cuántos juegos terminaste cada mes, en qué plataformas jugaste y un calendario con todos los juegos del año.

Solo cuentan los juegos de Jugados que tienen indicado el año en que los jugaste. El Rewind del año en curso aparece en Inicio a partir del 1 de diciembre. Los de años anteriores están siempre disponibles desde el botón del reloj, en la parte de arriba de la pantalla.

### Compartir y guardar

Desde cualquier lista puedes crear una imagen con los juegos que estás viendo, en cuadrícula o en lista, para compartirla o descargarla.

En los ajustes puedes **exportar** toda tu biblioteca a un archivo y **importarla** después, en el mismo móvil o en otro. Si pasa un mes sin que hagas una copia, Inicio te lo recuerda.

---

## Empezar a usarla

### Instalarla en el móvil

Abre la dirección de la app en el navegador del móvil y añádela a la pantalla de inicio:

- **Android (Chrome):** menú ⋮ → *Instalar aplicación*.
- **iPhone (Safari):** botón Compartir → *Añadir a pantalla de inicio*.

A partir de ahí se abre como una app más, también sin conexión. Solo necesita internet para buscar juegos y para descargar portadas que todavía no ha mostrado nunca.

### Conseguir la clave de RAWG

Para buscar juegos en RAWG hace falta una clave gratuita. Es un trámite de un minuto:

1. Crea una cuenta en [rawg.io/apidocs](https://rawg.io/apidocs) y copia la clave que te dan.
2. En la app, abre los ajustes (el engranaje), pega la clave en *Búsqueda de portadas* y pulsa *Guardar*.

Sin la clave la app funciona igual, pero los juegos se añaden a mano.

### Cuidar tus datos

Como no hay servidor, tu biblioteca vive solo en el navegador del móvil. Eso tiene dos consecuencias:

- **Si borras los datos del navegador o desinstalas la app, la biblioteca se pierde.** Conviene exportar una copia de vez en cuando (*Ajustes → Datos → Exportar*).
- **Cada dispositivo tiene su propia biblioteca.** Para pasarla de uno a otro, exporta en el primero e importa en el segundo. Ojo: importar sustituye por completo lo que hubiera.

### Actualizaciones

Cuando se publica una versión nueva, aparece un aviso en la parte de arriba. La app no se actualiza sola: lo hace cuando pulsas *Actualizar*, para no interrumpirte si estás editando un juego.

---

## Para desarrolladores

### Ponerla en marcha

La app son archivos estáticos: no tiene dependencias ni necesita compilarse. Para probarla en el ordenador basta un servidor web cualquiera:

```bash
python3 -m http.server 8000
```

y abrir `http://localhost:8000`. La parte que permite usarla sin conexión (el *service worker*) solo funciona en `localhost` o con HTTPS.

Para publicarla vale cualquier hosting estático con HTTPS. Con GitHub Pages: *Settings → Pages → Deploy from a branch*, rama `main` y carpeta raíz. Quedará en `https://<usuario>.github.io/<repositorio>/`.

### Publicar una versión nueva

Antes de subir cambios hay que **aumentar `VERSION` en `sw.js`** (por ejemplo, de `1.1.1` a `1.1.2`). Ese número es lo que hace que el navegador detecte que hay algo nuevo y muestre el aviso. Sin cambiarlo, quien ya tenga la app instalada seguirá con la versión anterior.

Si has añadido o renombrado algún archivo, inclúyelo también en la lista `SHELL` de `sw.js`. Así se guarda en el dispositivo y la app sigue funcionando sin conexión.

### Cómo está organizado el código

`index.html` contiene solo la estructura de la página y de sus paneles. El aspecto está en `css/` y el comportamiento en `js/`, repartido en archivos pequeños, cada uno con una única responsabilidad:

```
index.html            estructura de la app y de sus paneles
sw.js                 funcionamiento sin conexión, caché de portadas y versión
manifest.webmanifest  datos para instalarla (nombre, iconos, colores)

css/app.css           estilos de toda la app
css/rewind.css        estilo propio del Rewind, el único apartado más festivo

js/rawg-image.js      dirección de las portadas de RAWG en tamaño reducido (la usa también sw.js)
js/util.js            utilidades generales: crear elementos, guardar preferencias, validar y formatear
js/db.js              almacenamiento de los juegos en el dispositivo (IndexedDB)
js/state.js           estado en memoria y preferencias del usuario
js/model.js           las reglas: listas, ordenaciones y qué pasa al crear o mover un juego
js/ui.js              piezas de interfaz reutilizables: avisos, paneles, confirmaciones, portadas
js/views.js           navegación, Inicio y páginas de cada lista
js/edit.js            ficha del juego
js/rawg.js            conexión con la API de RAWG
js/add.js             añadir juegos y detectar duplicados
js/rewind.js          el Rewind
js/share-image.js     imagen de la lista para compartir
js/settings.js        ajustes y copias de seguridad
js/drag.js            arrastrar y soltar
js/updates.js         aviso de versión nueva
js/main.js            arranque
```

Los archivos de `js/` se cargan en ese orden y cada uno se apoya en los anteriores. Forman tres capas:

- **La base** (`util`, `db`, `state`) no sabe nada de la interfaz.
- **Las reglas** (`model`) no tocan la pantalla. Todo lo que debe ocurrir al crear un juego, cambiarlo de lista, marcarlo como favorito, reordenarlo o importarlo está ahí, en un único sitio. El resto de la app llama a esas funciones (`createGame`, `moveToStatus`, `setFavorite`, `applyOrder`…) en lugar de repetir la lógica.
- **La interfaz** (`ui`, `views` y un archivo por funcionalidad) pinta la pantalla a partir del estado y responde a lo que hace el usuario.

El flujo es siempre el mismo: una acción cambia los datos, se guardan en el dispositivo y se llama a `render()`, que vuelve a pintar la pantalla actual. Es un enfoque sencillo que va sobrado para bibliotecas de cientos de juegos y evita que la pantalla y los datos se desincronicen.

### Algunas decisiones

**Sin frameworks ni herramientas de compilación.** La app es lo bastante pequeña como para no necesitarlos. Así se puede publicar en cualquier sitio y abrir con un editor de texto, sin instalar nada.

**Scripts normales en lugar de módulos de JavaScript.** Los archivos comparten el mismo espacio de nombres y se cargan en el orden de `index.html`. Es lo que permite prescindir de herramientas, pero obliga a que cada nombre global sea único. Si la app creciera mucho, el paso natural sería convertirlos en módulos (`import`/`export`).

**Los datos viven en IndexedDB.** Al arrancar se cargan en memoria, en la variable `games`, y cada cambio se guarda en los dos sitios.

**Las portadas se guardan aparte.** El service worker las conserva en el dispositivo, hasta 800, en una caché que no se borra al actualizar la app. Las de RAWG se descargan a 1280 píxeles de ancho, suficiente para verse nítidas y mucho más ligeras que las originales.

### Cómo se guarda cada juego

Este es el formato de cada juego, tanto en el dispositivo como en las copias de seguridad:

| Campo | Qué guarda |
|---|---|
| `id` | identificador único |
| `title`, `year` | título y año de lanzamiento |
| `rawgId`, `avail` | identificador en RAWG y plataformas en las que salió (vacíos si se añadió a mano) |
| `platforms` | plataformas en las que lo has jugado, separadas por comas |
| `cover` | dirección de la portada, o la imagen subida desde el móvil |
| `status` | lista en la que está: `backlog`, `playing` o `played` |
| `favorite` | si está en Favoritos |
| `rating` | nota de 0 a 10, o vacío |
| `hours` | horas jugadas, o vacío |
| `playedY`, `playedM` | año y mes en que lo jugaste (el mes es opcional) |
| `rank`, `favRank` | posición en tu orden manual, en su lista y en Favoritos |
| `added`, `updated`, `finished` | cuándo se añadió, cuándo se modificó y cuándo se terminó |

Las preferencias (vista, orden de cada lista, columnas, clave de RAWG y fecha de la última copia) se guardan aparte, en el `localStorage` del navegador.

### Ampliar la app

- **Una nueva forma de ordenar:** se define su nombre en `SORTS` y cómo compara dos juegos en `COMPARE`, ambos en `model.js`. Después se añade a `SORTS_BY_CAT` en las listas donde tenga sentido.
- **Un dato nuevo en los juegos:** hay que darle un valor inicial en `createGame`, validarlo en `sanitizeGame` (para que las copias de seguridad lo importen bien) y añadirlo a la ficha, en `index.html` y `edit.js`.
- **Un archivo nuevo:** se añade a `index.html` en el lugar que le corresponda según de qué dependa, y a la lista `SHELL` de `sw.js`.

---

## Créditos

La información y las imágenes de los juegos vienen de [RAWG](https://rawg.io), que la app cita en el buscador tal como pide su API.
