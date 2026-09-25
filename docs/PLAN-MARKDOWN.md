# Plan: editor e intérprete de Markdown para posts

Estado de partida: rama `claude/practical-pasteur-2ur05z`, commit `823813c`. Ver «Estado» en la sección 4.

## 1. Diagnóstico

### 1.1 Bug crítico: editar un post borra su contenido

`PostsList` pasa al editor la fila del listado (`onEdit(p)`), pero `GET /api/posts`
no selecciona `p.body` (`api/handlers/posts.php:96`). El editor abre con el cuerpo
vacío y al guardar el `PATCH` envía `body: ""`, que sobrescribe el texto en la base de datos.

Además, el campo «Slug / ID» se puede editar en un post existente, pero `PATCH` lo
ignora (`id` no está en `$allowed`): la interfaz promete algo que no ocurre.

### 1.2 Intérprete (`src/markdown.js`)

Lo bueno: escapa todo el HTML antes de interpretar y filtra esquemas de URL. Las
pruebas de XSS (`onerror` en alt, comillas en la URL) salen inofensivas.

Lo que falla, probado con Node sobre el código actual:

| Entrada | Resultado actual |
|---|---|
| Lista anidada (`- a` / `  - b`) | Se aplana a un solo nivel |
| Párrafo seguido de lista sin línea en blanco | Sale como texto con `- ` literales |
| `3. tres` / `4. cuatro` | Empieza en 1 (se pierde el número inicial) |
| Tareas `- [ ]` / `- [x]` | Texto literal `[ ]` |
| Código dentro de un elemento de lista | Se rompe la lista y el bloque de código |
| Cita con lista o con varios párrafos | Todo en una línea con `<br>` |
| `#####` h5, títulos setext (`===`) | Párrafo literal |
| Enlace con paréntesis (Wikipedia) | URL cortada y `)` suelto |
| Enlace o imagen con título `"…"` | No se interpreta |
| URLs sueltas y `<https://…>` | No se enlazan |
| `_cursiva_`, `__negrita__` | No se interpretan |
| Escapes `\*` | Muestra `\` y aplica la cursiva igualmente |
| `- - -` | Lista en vez de `<hr>` |
| Notas al pie `[^1]` | Texto literal |
| Código en línea con backtick dentro | Se rompe |
| Encabezados | Sin `id`: no hay enlaces a secciones ni índice |

Tampoco hay resaltado de sintaxis ni botón de copiar en los bloques de código, lo que pesa
en un blog técnico.

### 1.3 Estilos inconsistentes entre superficies

El mismo HTML se pinta en tres sitios con coberturas distintas:

| Elemento | Escritorio `.post-body` | Móvil `.m-prose` | Panel `.md-preview` |
|---|---|---|---|
| h2 | ✓ | ✓ | ✓ |
| h3 / h4 | ✗ | ✓ | h3 ✓ |
| listas | ✗ | ✓ | ✗ |
| cita | ✗ | ✓ | ✗ |
| imagen | ✗ | ✓ | ✗ |
| enlaces / hr | ✗ | ✓ | ✗ |
| tablas | ✓ | ✓ | ✓ |

La vista previa del panel usa el tema claro del admin, así que no se parece al post
publicado.

### 1.4 Imágenes externas bloqueadas en silencio

La CSP de `.htaccess` tiene `img-src 'self' data:`. Un `![x](https://…)` genera la
etiqueta, pero el navegador no la carga, y ni el editor ni el intérprete avisan.

### 1.5 Editor (`src/admin-app.jsx`, `Editor`)

- Un `<textarea>` de 340 px con pestañas Editar/Preview: no se ve el resultado mientras se escribe.
- No hay barra de herramientas ni atajos (Ctrl+B, Ctrl+K, Ctrl+S).
- No se pueden insertar imágenes de la biblioteca Multimedia ni pegar o arrastrar imágenes.
- No hay aviso de cambios sin guardar (en «Sobre mí» sí lo hay), ni autoguardado.
- No hay contador de palabras ni tiempo de lectura.
- El slug no se genera a partir del título.

## 2. Decisión principal: ¿seguir con el intérprete propio o usar una librería?

El proyecto ya compila con esbuild en local (`npm run build`), y IONOS solo recibe
`assets/*.js`. Por eso una dependencia npm **no afecta al hosting**: se empaqueta en el bundle.

**Recomendación: `markdown-it`** (CommonMark completo), configurado así:

- `html: false`: escapa cualquier HTML del autor, igual que hoy.
- `validateLink`: bloquea `javascript:`, `vbscript:`, `file:` y `data:` salvo imágenes. Se endurece para permitir solo `http(s)`, `mailto` y rutas relativas, como `safeUrl` actual.
- `breaks: true`: mantiene el salto de línea simple como `<br>`, igual que hoy, para no cambiar el aspecto de los posts existentes.
- `linkify: true` para las URLs sueltas.
- Plugins: `markdown-it-footnote`, y reglas propias pequeñas para tareas, para `# → h2` (se conserva el comportamiento actual) y para anclas en los encabezados.

Alternativa: arreglar el parser propio. Cada caso de la tabla 1.2 es un parche con
expresiones regulares, y las listas anidadas y el código dentro de listas exigen reescribirlo
como parser de bloques. Eso es reimplementar CommonMark.

Coste estimado de la librería: unos 35 KB gzip más por bundle (hoy `app.js` pesa 65 KB gzip).
Se medirá al compilar.

## 3. Plan por fases

### Fase 0 — Corregir la pérdida de datos (urgente, independiente del resto)

1. `goEdit` carga el post completo con `GET /api/posts/:id` (ya devuelve `body` si hay sesión admin) antes de abrir el editor, y muestra «Cargando…» mientras tanto.
2. Defensa en el servidor: en `PATCH`, si `body` llega vacío y el post tenía cuerpo, rechazar con 400 salvo que venga `force_empty_body: true`.
3. En posts existentes, el slug se muestra en solo lectura con el texto «no editable tras crear». Renombrar un slug queda como mejora aparte, porque implica actualizar `comments`, `pageviews` y `post_tags`.

### Fase 1 — Intérprete nuevo (`src/markdown.js`)

1. `npm install markdown-it markdown-it-footnote`.
2. Reescribir `src/markdown.js` manteniendo la API pública (`window.renderMarkdown`, `window.readingTime`) para no tocar `apps.jsx`, `mobile.jsx` ni `admin-app.jsx`:
   - Envolver tablas en `<div class="md-table">` (el CSS actual sigue valiendo).
   - Enlaces externos con `target="_blank" rel="noopener noreferrer"`.
   - Imágenes con `loading="lazy"`; si tienen título, `<figure>` + `<figcaption>`.
   - Encabezados con `id` generado (slug en español sin tildes, desduplicado).
   - Tareas `- [ ]` / `- [x]` como casillas deshabilitadas.
   - Avisos estilo GitHub `> [!NOTE]`, `> [!WARNING]` (opcional, pero útil en un blog técnico).
3. Exportar también `window.markdownToc(src)`, que devuelve `[{level, id, text}]` para el índice de la fase 3.
4. Pruebas con `node --test` (incluido en Node, sin dependencias) en `tests/markdown.test.mjs`:
   - Cada fila de la tabla 1.2.
   - Casos de XSS: `<script>`, `javascript:`, `data:text/html`, comillas en alt y URL, `onerror`.
   - Posts de ejemplo de `schema.sql` renderizados: comprobar que no cambian de forma visible.
   - Añadir `"test": "node --test tests/"` a `package.json`.

### Fase 2 — Resaltado de sintaxis y bloques de código

1. `highlight.js/lib/core` con lenguajes registrados a mano: bash, shell, javascript, typescript, php, python, rust, c, cpp, go, sql, json, yaml, ini, diff, css, xml/html, dockerfile. Se cargan solo esos, no los 190.
2. Colores con variables CSS (`--neon`, `--neon-2`…), de modo que el resaltado siga al color de acento de la ventana «Ajustes».
3. Cabecera del bloque con el lenguaje y un botón «copiar». Como el HTML entra por `dangerouslySetInnerHTML`, el clic se gestiona por delegación en el contenedor del post.

### Fase 3 — Estilos unificados y lectura

1. Nuevo `assets/prose.css` con una clase `.md` que cubra **todos** los elementos generados (h2–h4, p, listas y listas anidadas, tareas, cita, avisos, código, tablas, imágenes/figure, hr, notas al pie, del). Usa variables CSS; cada superficie solo redefine tamaños y colores:
   - `.post-body.md` (escritorio), `.m-prose.md` (móvil), `.md-preview.md` (panel, con tema oscuro del sitio para que la vista previa sea fiel).
2. Índice automático en posts con 3 o más encabezados: panel lateral en la ventana del lector de escritorio y desplegable en el móvil.
3. Clic en una imagen del post: abre la ventana de imagen existente en escritorio y un visor a pantalla completa en móvil.

### Fase 4 — Editor

Mejorar el `<textarea>` sin dependencias pesadas. CodeMirror 6 añadiría unos 150 KB y no hace falta para un solo autor.

1. **Vista dividida**: editor y vista previa en vivo lado a lado (con `useDeferredValue` para no bloquear al escribir) y desplazamiento sincronizado por proporción. En pantallas estrechas vuelven las pestañas.
2. **Barra de herramientas y atajos**:
   - Negrita (Ctrl+B), cursiva (Ctrl+I), enlace (Ctrl+K), código, H2/H3, lista, lista numerada, tarea, cita, tabla (inserta una plantilla 3×2) y bloque de código con selector de lenguaje.
   - Ctrl+S guarda.
   - Tab / Shift+Tab indentan las líneas seleccionadas.
   - Enter continúa listas y citas; Enter en un elemento vacío termina la lista.
   - Las ediciones usan `document.execCommand('insertText')` cuando está disponible, para conservar el deshacer (Ctrl+Z) del navegador.
3. **Imágenes**:
   - Botón «Insertar imagen» que abre un selector de la biblioteca Multimedia (reutiliza `GET /api/media`) e inserta `![nombre](/uploads/media/…)`.
   - Pegar o arrastrar una imagen en el editor la sube por `POST /api/media` e inserta el Markdown, con un marcador «subiendo…» que se sustituye al terminar.
   - Aviso en la vista previa cuando una imagen apunta a un dominio externo (la CSP la bloqueará).
4. **Seguridad del trabajo**:
   - Indicador de «Cambios sin guardar» y aviso al salir (`beforeunload` y al pulsar «← Volver»), igual que en «Sobre mí».
   - Borrador local en `localStorage` cada pocos segundos por post (`jr-draft-<id|nuevo>`), con la opción «Restaurar borrador» si es más reciente que lo guardado.
5. **Metadatos**:
   - Slug generado a partir del título mientras el usuario no lo toque (solo en posts nuevos).
   - Contador de palabras y tiempo de lectura.
   - Botón «Generar extracto» que toma el primer párrafo sin formato Markdown.
   - Editor más alto (se ajusta al contenido, con un mínimo de unos 60vh).
6. **Chuleta** de sintaxis accesible desde un botón «?».

### Fase 5 — Opcional / después

- Campo `scheduled_at` en el editor (la API ya lo acepta y la interfaz no lo muestra) y publicación programada.
- Renombrar el slug con actualización en cascada.
- Búsqueda pública también en el cuerpo del post (hoy solo busca en título y extracto).
- Render en servidor (PHP) para SEO, RSS y vista previa al compartir. Hoy el contenido solo existe tras ejecutar JS, pero requeriría un parser Markdown en PHP sin Composer.

## 4. Decisiones tomadas

1. **`markdown-it`** en lugar del parser propio.
2. **Imágenes externas**: se mantiene la CSP estricta (`img-src 'self' data:`). El editor avisa y
   marca la imagen en la vista previa para que se suba a Multimedia.
3. **Avisos `> [!NOTE]` e índice automático**: incluidos. El índice solo aparece en posts con 3 o
   más encabezados; en el móvil sale plegado.

## Estado

Fases 0 a 4 implementadas en la rama `claude/markdown-editor`. Cambios respecto al plan:

- **Resaltado bajo demanda**: highlight.js va en un bundle aparte (`assets/hljs.js`, ~29 KB gzip)
  que solo se descarga cuando un post tiene bloques de código.
- **`entities` sustituido**: markdown-it arrastraba las 2 000+ entidades de HTML5 (~75 KB sin
  comprimir). `src/shims/entities.js` cubre las habituales; las desconocidas se muestran literales.
- Tamaño gzip resultante: `app.js` 65 → 93 KB, `admin.js` 56 → 90 KB.
- El editor sigue siendo un `<textarea>` mejorado (sin CodeMirror).

La Fase 5 (publicación programada, renombrar slug, render en PHP) sigue pendiente.

## 5. Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/markdown.js` | Reescritura sobre markdown-it (misma API global) |
| `src/admin-app.jsx` | Fase 0 + nuevo `Editor` (o separarlo en `src/editor.jsx`) |
| `src/apps.jsx`, `src/mobile.jsx` | Clase `.md`, índice, delegación de copiar e imagen |
| `api/handlers/posts.php` | Defensa contra `body` vacío en `PATCH` |
| `assets/prose.css` (nuevo), `assets/styles.css`, `assets/mobile.css`, `admin.html` | Estilos unificados y resaltado |
| `index.html`, `admin.html` | Enlazar `assets/prose.css` |
| `package.json` | Dependencias y script `test` |
| `tests/markdown.test.mjs` (nuevo) | Pruebas del intérprete |
| `docs/DESPLIEGUE.md` | Recordar `npm test && npm run build` antes de subir |

## 6. Verificación

- `npm test` pasa (casos de la tabla 1.2 + XSS).
- `npm run build` compila; anotar el tamaño gzip de `app.js` y `admin.js` antes y después.
- Editar un post existente: el cuerpo aparece y, tras guardar, se conserva (regresión de la fase 0).
- El mismo post se ve igual en el lector de escritorio, en la vista móvil y en la vista previa del panel.
- Pegar una captura en el editor la sube y aparece en la vista previa.
- Probar con la CSP real (servidor Apache local o IONOS): sin errores en la consola.
