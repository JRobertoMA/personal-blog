# Análisis de seguridad, UX y UI — jrobertoma.com

Revisión del proyecto `personal-blogv1` antes de subirlo a un hosting compartido de IONOS.
Cada hallazgo indica su **gravedad** y si **ya está corregido** en este repositorio.

---

## 1. Seguridad

### 🔴 Crítico

| # | Hallazgo | Riesgo | Estado |
|---|----------|--------|--------|
| S1 | **El `.env` venía dentro del zip con la contraseña real de la base de datos** (usuario `root`). | Cualquiera que reciba el zip (o que acceda al archivo si se sube a la carpeta pública) obtiene acceso total a MariaDB. | ✅ `.env` añadido a `.gitignore` y bloqueado en `.htaccess`. **Acción tuya: cambia esa contraseña** si la usas en algún otro sitio, y en IONOS usa el usuario propio de la base de datos, nunca `root`. |
| S2 | **Errores de PHP visibles**: si la conexión a la BD fallaba, PHP podía mostrar la traza de la excepción de PDO, que incluye usuario y contraseña. | Filtración de credenciales. | ✅ `display_errors=0`, manejador global de excepciones que responde un 500 genérico y registra el detalle en el log. La excepción de conexión se relanza sin argumentos. |
| S3 | **Usuario `admin` con hash por defecto en `schema.sql`** (hash público y conocido). | Acceso al panel si no se cambia. Además el hash no correspondía a `changeme`, así que ni siquiera funcionaba. | ✅ Eliminado. `schema.sql` explica cómo crear tu usuario con tu propio hash. |
| S4 | **Babel + React en modo desarrollo desde unpkg**, sin SRI en `admin.html`. | Si el CDN se compromete, el atacante ejecuta código en tu panel de administración con tu sesión. Impide también una CSP estricta. | ✅ El JSX ahora se compila con esbuild a `assets/app.js` y `assets/admin.js`. No se carga ningún script externo. |

### 🟠 Alto

| # | Hallazgo | Estado |
|---|----------|--------|
| S5 | Sin cabeceras de seguridad (CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`…). | ✅ Añadidas en `.htaccess`. CSP `script-src 'self'` (posible gracias a S4). HSTS preparado pero comentado: actívalo cuando confirmes que el SSL funciona. |
| S6 | Cookie de sesión sin `Secure`, `HttpOnly` explícito ni `SameSite`. | ✅ `Secure` (en HTTPS), `HttpOnly`, `SameSite=Strict`, `use_strict_mode`. Tras el login se regenera el id y se vacía la sesión. |
| S7 | Formularios públicos (comentarios, contacto) sin límite por IP: fácil inundar la BD de spam. | ✅ Límite de 5 comentarios / 10 min y 3 mensajes / 30 min por IP, además del honeypot y el tiempo mínimo. Se respeta el ajuste `comments_enabled`. |
| S8 | `POST /api/posts/:id/view` aceptaba cualquier id: se podían crear filas infinitas en `pageviews`. | ✅ Solo cuenta posts publicados que existen, y el frontend cuenta una visita por post y sesión. |
| S9 | Subida de archivos: el `.htaccess` de `uploads/` solo bloqueaba `.php` (no `.phtml`, `.phar`, `.php5`…). `UPLOAD_PATH` relativo se resolvía desde `api/`, así que las imágenes acababan en `api/uploads/media` (inaccesibles). | ✅ `uploads/.htaccess` bloquea toda extensión ejecutable, quita handlers y aplica `nosniff` + CSP. Nombre aleatorio con `random_bytes`, se valida que sea una imagen real con `getimagesize`, y la ruta relativa se resuelve desde la raíz del proyecto. |
| S10 | Sin redirección a HTTPS. | ✅ Redirección 301 en `.htaccess`. |

### 🟡 Medio / bajo

| # | Hallazgo | Estado |
|---|----------|--------|
| S11 | Logout sin CSRF (cualquier web podía cerrarte la sesión). | ✅ Requiere token. |
| S12 | El CSRF también se aceptaba en el cuerpo JSON. | ✅ Solo cabecera `X-CSRF-Token`. |
| S13 | Sin validación de `status` (comentarios/posts), color de categoría ni slug del post. | ✅ Listas blancas y expresiones regulares. |
| S14 | Enumeración de usuarios por tiempo de respuesta en el login. | ✅ Se verifica siempre contra un hash (ficticio si el usuario no existe). |
| S15 | El renderizador de Markdown rompía los bloques de código y no permitía enlaces seguros. | ✅ Nuevo `src/markdown.js`: escapa todo el HTML, bloquea `javascript:`/`data:` en enlaces e imágenes, añade `rel="noopener"`. |
| S16 | `schema.sql`, `.md`, `package.json`, `src/` y `node_modules/` serían descargables. | ✅ Bloqueados en `.htaccess`. Aun así, **no subas** `src/`, `node_modules/`, `docs/` ni `schema.sql` (ver `DESPLIEGUE.md`). |
| S17 | `admin.html` es público y se indexaría en buscadores. | ✅ `noindex`. **Recomendado**: protege `admin.html` con usuario/contraseña de IONOS (*Protección de directorios*) como segunda capa. |
| S18 | Una sesión PHP por cada visitante anónimo. | ✅ La sesión solo se abre si ya hay cookie o en el login. |
| S19 | La API de galería (`GET /api/media`) exigía login, así que la galería pública siempre mostraba placeholders. | ✅ Lectura pública con los campos mínimos. |

### Pendiente / recomendaciones (no automatizables desde el código)

1. SSL: resuelto con Cloudflare en modo Flexible (ver [CLOUDFLARE.md](CLOUDFLARE.md)). Cuando todo lleve un tiempo funcionando por HTTPS, descomenta la línea HSTS del `.htaccess`.
2. Con el proxy de Cloudflare, `clientIp()` debe usar `CF-Connecting-IP` (validando que la petición viene de Cloudflare) para que los límites por IP vean al visitante real.
3. Sube el `.env` **fuera** de la carpeta del dominio (IONOS permite que el dominio apunte a una subcarpeta, p. ej. `/blog`; deja el `.env` en `/`). `api/config/database.php` lo busca hasta 2 niveles por encima de la raíz del proyecto.
4. Usa una contraseña de administrador larga (≥ 16 caracteres) y un nombre de usuario distinto de `admin`.
5. Haz copias de seguridad periódicas de la BD desde el panel de IONOS.
6. Si en el futuro activas `webhook_url`, valida en el servidor que sea `https://` para evitar SSRF.

---

## 2. UX (experiencia de uso)

### Problemas encontrados

**Móvil (la parte más débil):**

- **Se imitaba un teléfono dentro del teléfono**: pantalla de bloqueo falsa, barra de estado inventada ("5G ▲ 100%") duplicada sobre la real del móvil, y una pantalla de inicio con iconos. El visitante tenía que "desbloquear" antes de leer nada.
- **Botones que no hacían lo que decían**: "Buscar" y "Tags" abrían el listado; "Contacto" abría *Ajustes*; "Galería" y "Notas" no hacían nada.
- **No había búsqueda real** en móvil, aunque el icono lo prometía.
- **Los posts se veían sin formato**: se mostraban los `##` y los ``` literalmente, porque el móvil no usaba el renderizador de Markdown.
- **El botón "atrás" del teléfono sacaba al usuario del sitio**: no había rutas, todo era estado interno. Tampoco se podía compartir el enlace a un post.
- La página tenía `overflow: hidden` y un contenedor de altura fija: sin scroll nativo, sin inercia correcta, sin "toca arriba para volver al inicio".
- Objetivos táctiles de ~32 px (< 44 px recomendados), textos de 10–11 px y campos de formulario < 16 px, lo que provoca el **zoom automático de iOS** al escribir.
- Las **tablets** recibían la versión de escritorio, pero las ventanas solo se arrastran con ratón: inutilizable al tacto.

**General (móvil y escritorio):**

- 🐞 **Bug grave: los posts se mostraban vacíos.** `GET /api/posts` no devuelve el cuerpo, y tanto el lector como la ventana de post lo leían de esa lista. Ahora se pide `GET /api/posts/:id` bajo demanda y se cachea.
- La animación de arranque (4 s) se mostraba también al abrir un enlace directo a un post.
- Formularios sin `<label>` asociados ni `autocomplete`.
- Datos de contacto en "Sobre mí" como texto, no como enlaces.

### Qué se ha cambiado

- **Nueva versión móvil** (`src/mobile.jsx` + `assets/mobile.css`) diseñada como lector de blog:
  - Cabecera fija con el logo `jr·os` y acceso a búsqueda.
  - **Barra de pestañas inferior** con 4 destinos claros: *Blog, Buscar, Contacto, Sobre mí* (al alcance del pulgar, con indicador activo).
  - Chips de categoría deslizables y fijos bajo la cabecera.
  - Tarjeta destacada para el último post, luego lista con categoría, fecha, extracto y nº de comentarios.
  - **Rutas con hash** (`#/post/compilando-kernel`, `#/categoria/linux`, `#/tag/rust`, `#/buscar`…): el botón atrás funciona, los enlaces se pueden compartir y al volver al listado **se restaura la posición de scroll**.
  - Vista de post con tipografía de lectura (17,5 px, interlineado 1,7), tiempo de lectura, **barra de progreso**, bloques de código con scroll horizontal y etiqueta del lenguaje, botón **Compartir** (menú nativo del móvil o copia el enlace), comentarios bajo demanda y navegación *anterior / siguiente*.
  - **Búsqueda real** que ignora tildes, filtra por título, extracto, categoría o `#tag`, con nube de tags y posts recientes.
  - La terminal se conserva como *easter egg* desde "Sobre mí", junto con el selector de color de acento.
  - Estados vacíos, esqueletos de carga y aviso "Enlace copiado".
  - Objetivos táctiles ≥ 44 px, inputs a 16 px, `safe-area-inset` para notch y barra de gestos, `prefers-reduced-motion`, foco visible y `aria-*` en la navegación.
- **Detección de móvil** por `(max-width: 820px), (pointer: coarse)`: tablets y pantallas táctiles reciben la versión táctil (con cuadrícula de 2 columnas en tablets).
- **Escritorio**: se mantiene la metáfora de sistema operativo, ahora con el contenido de los posts visible, apertura directa del post desde un enlace compartido (sin animación de arranque) y enlaces reales en "Sobre mí".

---

## 3. UI (aspecto visual)

- Se mantiene la identidad: fondo casi negro, verde neón como acento, *JetBrains Mono* para metadatos y *Space Grotesk* para títulos. En móvil se usa *Inter* para el texto largo, más legible.
- Contraste: los grises de metadatos pasan de `#6b7280` (≈4:1) a `#8a919c` (> 5:1) en móvil.
- Se sustituyen los emojis de la navegación móvil por **iconos SVG** de trazo coherente, que heredan el color de acento.
- Cada categoría tiñe su tarjeta (punto de color, borde y degradado sutil en la destacada) usando el color definido en la BD.
- Tamaños: títulos de post `clamp(27px, 7.4vw, 36px)`, tarjetas 18,5 px, extractos 15 px — nada por debajo de 11,5 px.

Capturas del nuevo móvil en `docs/capturas/`.

---

## 4. Rendimiento

| | Antes | Ahora |
|---|---|---|
| JavaScript descargado | ~3,3 MB (React dev + ReactDOM dev + Babel standalone) + JSX sin compilar | **~190 KB** (≈ 60 KB gzip) |
| Compilación en el navegador | Sí, en cada visita (muy lento en móviles modestos) | No |
| Peticiones a CDNs de terceros | 3 scripts de unpkg | 0 (solo Google Fonts para CSS) |

---

## 5. Ideas para el futuro

- Generar un `feed.xml` (RSS) desde PHP: "Sobre mí" ya lo anuncia.
- Renderizado en servidor o páginas estáticas por post para SEO (ahora el contenido depende de JavaScript).
- Etiquetas Open Graph por post (requiere lo anterior).
- Publicación programada real (`scheduled_at` existe en la BD pero nada lo procesa).
- Notas y galería del escritorio con contenido real desde el panel.
