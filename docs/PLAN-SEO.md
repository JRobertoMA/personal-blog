# Plan: SEO de jrobertoma.com

Estado de partida: rama `claude/practical-pasteur-2ur05z`, commit `4a3fb63` (editor Markdown ya fusionado).

## 1. Diagnóstico

1. **Un solo URL para todo el blog.** Las rutas son `/#/post/<slug>` y los buscadores ignoran lo que
   va tras `#`: para Google solo existe la portada.
2. **HTML vacío.** El servidor entrega `<div id="root"></div>` y el texto lo pinta JavaScript. Google
   lo renderiza con retraso; Bing, DuckDuckGo y las vistas previas de WhatsApp, Telegram, Mastodon o
   LinkedIn no ejecutan JS y solo ven «jrobertoma.com».
3. **Metadatos fijos.** Mismo `<title>`, descripción y Open Graph en todas las páginas; sin
   `canonical`, sin imagen para compartir y sin datos estructurados.
4. **Faltan `robots.txt`, `sitemap.xml` y `feed.xml`** (este último ya se anuncia en «Sobre mí»).
5. **Soft 404.** Cualquier ruta devuelve `index.html` con código 200.

## 2. Decisiones

- **URLs reales**: `/post/<slug>`, `/categoria/<id>`, `/tag/<tag>`, `/sobre-mi`, `/buscar`, `/contacto`,
  `/terminal`. Los enlaces antiguos `/#/post/<slug>` se convierten en el navegador a la ruta nueva.
- **Un controlador PHP (`page.php`)** atiende todas las páginas: inserta en `index.html` el `<head>`
  de cada página y el contenido en HTML dentro de `#root`. React lo sustituye al arrancar; los
  buscadores, las vistas previas y quien no tenga JavaScript leen ese HTML.
- **Markdown en PHP con Parsedown 1.7.4** (un archivo, MIT, modo seguro, sin Composer) en
  `api/lib/`. Su salida puede diferir en detalles de la de markdown-it; solo la ven los buscadores y
  el primer instante de carga.
- **`<base href>`** generado por `page.php`: las rutas relativas (`assets/`, `api/`, `uploads/`) siguen
  funcionando en `/post/<slug>` y en una copia local dentro de una subcarpeta.
- **No bloquear `/api/` en `robots.txt`**: Google necesita la API para renderizar la versión con JS.
  En su lugar la API envía `X-Robots-Tag: noindex` para que sus JSON no aparezcan en resultados.
- **404 reales** para posts, categorías o tags inexistentes (o sin publicar), con `noindex`.
- **Tags con `noindex, follow`**: son listados finos que compiten con los posts; las categorías sí
  se indexan y van en el sitemap.

## 3. Fases

### S1 — URLs reales y HTML en el servidor
1. `.htaccess`: `DirectoryIndex page.php`; `/index.html` → 301 a `/`; rutas sin extensión,
   `sitemap.xml`, `feed.xml` y `robots.txt` → `page.php`. Todo lo demás, como hasta ahora.
2. `page.php` + `api/lib/seo.php`:
   - `<title>`, `description`, `canonical`, Open Graph (`og:type` `article` en posts, con
     `article:published_time`, `modified_time`, `section` y `tag`), Twitter Card.
   - `og:image`: la primera imagen del post (absoluta). S3 añadirá la portada elegida.
   - HTML: portada con la lista de posts, post completo con categoría, tags y anterior/siguiente,
     categoría, tag y «Sobre mí».
   - 404 con `noindex` y 503 (con la app igualmente) si la base de datos no responde.
3. Frontend: router del móvil con History API (`pushState`/`popstate`) e intercepción de enlaces
   internos; el escritorio abre el post de `/post/<slug>`; los enlaces del panel apuntan a las rutas
   nuevas; conversión de `/#/…` a la ruta nueva.

### S2 — robots, sitemap, feed y datos estructurados
- `robots.txt` dinámico: permite todo salvo `admin.html` y apunta al sitemap.
- `sitemap.xml`: portada, «Sobre mí», categorías con posts y posts publicados con `lastmod`.
- `feed.xml`: RSS 2.0 con los 20 últimos posts y el contenido completo (`content:encoded`), URLs
  absolutas; respeta `rss_enabled`. `<link rel="alternate">` en todas las páginas.
- JSON-LD: `BlogPosting` + `BreadcrumbList` en posts; `WebSite` + `Person` en la portada;
  `ProfilePage` en «Sobre mí».

### S3 — SEO desde el editor (pendiente)
- Portada por post (`posts.cover_image`, elegida de Multimedia) para `og:image` y JSON-LD; imagen
  genérica del blog si no hay ninguna.
- Descripción para buscadores con contador (~155 caracteres); por defecto, el extracto.
- Vista previa del resultado en Google y de la tarjeta al compartir.
- Aviso de imágenes sin texto alternativo.

### S4 — Puesta en marcha (manual)
- Google Search Console y Bing Webmaster Tools: verificar por DNS (registro TXT en Cloudflare) y
  enviar `https://jrobertoma.com/sitemap.xml`.
- Cloudflare: comprobar que *Bot Fight Mode* no bloquea a Googlebot/Bingbot.
- Validar con la prueba de resultados enriquecidos de Google y los depuradores de vistas previas
  (Facebook Sharing Debugger, opengraph.xyz).

## Estado

S1 y S2 implementados (PR #2). S3 implementado en la rama `claude/seo-editor`. S4 está descrito en
`docs/DESPLIEGUE.md` (sección 7).

S3, tal como quedó:
- **Portada** (`posts.cover_image`, migración `migrations/2026-09-28-cover-image.sql`): se elige o
  sube desde el editor; solo se aceptan imágenes de Multimedia. `og:image` usa portada → primera
  imagen del post → `assets/og-default.png` (1200×630), con `og:image:width/height/alt`.
  Sin la migración, la web y el guardado siguen funcionando; solo elegir portada avisa de que falta.
- **Descripción**: el extracto hace de descripción para buscadores (sin columna nueva), con contador
  de 155 caracteres; «Generar desde el contenido» ya recorta a esa longitud. Sin extracto se usa el
  primer párrafo.
- **Vista previa** en la barra lateral del editor: resultado en Google y tarjeta al compartir.
- **Texto alternativo**: aviso en la barra de estado de las imágenes sin descripción o con una
  genérica («image», «captura de pantalla…», «IMG_1234»).

Notas de la implementación:
- `api/lib/Parsedown.php` es la 1.7.4 con un solo cambio (`?array` en dos firmas) para PHP 8.4+.
- `aboutDefaults()`/`loadAbout()` pasan a `api/lib/about-data.php`, compartido por la API y `page.php`.
- Los tags con punto (`node.js`) funcionan: `.htaccess` manda a `page.php` todo lo que no existe
  salvo `assets/` y `uploads/`.
- Probado con Apache 2.4 + mod_php + `.htaccess` reales, en la raíz y en una subcarpeta.

## 4. Verificación

- `curl` de `/post/<slug>` devuelve 200, título y descripción del post, `canonical`, OG y JSON-LD
  válido, y el texto del post en el HTML sin ejecutar JS.
- `/post/no-existe`, `/categoria/x` y un borrador → 404 con `noindex`.
- `/index.html` → 301 a `/`; `/#/post/<slug>` termina en `/post/<slug>`.
- `sitemap.xml` y `feed.xml` válidos (XML bien formado; el feed pasa el validador W3C).
- Navegación en móvil (atrás/adelante, scroll recordado, compartir) y escritorio sin regresiones.
- Recursos relativos (`assets/`, `api/`, imágenes de posts) cargan bajo `/post/<slug>` y en subcarpeta.
- Sin errores de consola ni de CSP.
