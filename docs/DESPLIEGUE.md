# Despliegue en IONOS (hosting compartido)

## 1. Compilar el frontend (en tu PC)

Solo hace falta si modificas algo en `src/`. Los archivos compilados ya van en el repo.

```bash
npm install
npm test             # pruebas del intérprete de Markdown (incluye casos de XSS)
npm run build        # genera assets/app.js, assets/admin.js y assets/hljs.js
npm run watch        # opcional: recompila al guardar mientras desarrollas
```

## 2. Base de datos

1. En el panel de IONOS: **Hosting → Bases de datos → Crear base de datos (MariaDB)**. Anota host (`dbXXXX.hosting-data.io`), nombre, usuario y contraseña.
2. Abre **phpMyAdmin** e importa `schema.sql`.
   - **Si la base de datos ya existía**, ejecuta además (pestaña SQL) cada archivo nuevo de
     `migrations/`, en orden de fecha. Son seguros de repetir. Hoy: `2026-09-28-cover-image.sql`
     (portada de los posts).
3. Crea tu usuario administrador. En tu PC:
   ```bash
   php -r 'echo password_hash("una-contraseña-larga-y-única", PASSWORD_DEFAULT), PHP_EOL;'
   ```
   y en phpMyAdmin:
   ```sql
   INSERT INTO admin_users (username, password_hash) VALUES ('tu_usuario', '$2y$10$...');
   ```

## 3. Subir archivos (SFTP)

Estructura recomendada en el espacio web:

```
/                         ← raíz de tu espacio (NO pública)
├── .env                  ← credenciales, fuera del alcance web
└── blog/                 ← carpeta a la que apunta el dominio
    ├── .htaccess
    ├── index.html        (plantilla: la sirve page.php)
    ├── page.php          (páginas, robots.txt, sitemap.xml y feed.xml)
    ├── admin.html
    ├── api/              (con su .htaccess; incluye api/lib/)
    ├── assets/           (prose.css, styles.css, mobile.css, app.js, admin.js, hljs.js, og-default.png)
    └── uploads/          (con su .htaccess y uploads/media/)
```

En **Dominios y SSL → tu dominio → Destino**, apunta el dominio a `/blog`.

**No subas**: `src/`, `tests/`, `migrations/`, `node_modules/`, `docs/`, `schema.sql`, `package*.json`, `build.mjs`, `.git/`.
(Están bloqueados por `.htaccess` por si acaso, pero es mejor que no estén.)

Copia `.env.example` como `.env`, rellena los datos de IONOS y súbelo a `/`.

- Si la contraseña de la base de datos tiene comillas, `#` u otros símbolos, escríbela entre **comillas simples**
  (`DB_PASS='…'`). Reglas completas en [PROBLEMAS-IONOS.md](PROBLEMAS-IONOS.md#reglas-para-escribir-valores-en-el-env).
- Añade `LOG_FILE=personal-blog-errors.log` para poder ver los errores de la API: IONOS no da acceso al log de PHP.

Si algo falla tras subirlo (404 en la API, 500, «Error interno del servidor»), ver [PROBLEMAS-IONOS.md](PROBLEMAS-IONOS.md).

## 4. PHP y SSL

- **PHP ≥ 8.1** (en *Hosting → PHP*). Se usa `str_starts_with`, arrow functions, etc.
- **SSL**: IONOS no emite certificado porque los DNS están en Cloudflare. El HTTPS lo da Cloudflare en modo
  Flexible; la configuración completa está en [CLOUDFLARE.md](CLOUDFLARE.md). El `.htaccess` ya redirige a HTTPS.
- Cuando confirmes que todo va por HTTPS, descomenta la línea `Strict-Transport-Security` del `.htaccess`.
- Dale permisos de escritura a `uploads/media/` (755 suele bastar en IONOS).

## 5. Capa extra para el panel (recomendado)

IONOS permite proteger archivos/carpetas con usuario y contraseña (*Hosting → Protección de directorios* o `.htpasswd`). Protege `admin.html` para que ni siquiera se vea el formulario de login.

Con Cloudflare delante, la protección principal es **Cloudflare Access** (ver [CLOUDFLARE.md](CLOUDFLARE.md#4-proteger-el-panel-con-cloudflare-access)).

## 6. Comprobaciones tras subir

- `https://tudominio/.env` → debe dar **403**.
- `https://tudominio/schema.sql` → **403** (o 404 si no lo subiste).
- `https://tudominio/api/config/database.php` → no debe mostrar nada sensible.
- `https://tudominio/api/posts` → JSON con tus posts.
- Abre la web en el móvil y comparte un post: el enlace `/post/...` debe abrir directamente ese post.
  Los enlaces antiguos `/#/post/...` siguen funcionando (se convierten solos).
- `https://tudominio/post/<slug>` → **200**; el código fuente (Ctrl+U) debe incluir el título del post
  en `<title>` y su texto dentro de `<div id="root">`.
- `https://tudominio/post/no-existe` → **404**.
- `https://tudominio/index.html` → redirige (301) a `https://tudominio/`.
- `https://tudominio/robots.txt`, `/sitemap.xml` y `/feed.xml` → texto/XML con tus posts.

## 7. Buscadores (una vez, tras el primer despliegue con URLs reales)

1. **Google Search Console** (search.google.com/search-console): *Añadir propiedad → Dominio*,
   `jrobertoma.com`. Te da un registro TXT: créalo en Cloudflare (*DNS → Add record → TXT*, nombre `@`).
   Tras verificar, en *Sitemaps* envía `https://jrobertoma.com/sitemap.xml`.
2. **Bing Webmaster Tools** (bing.com/webmasters): puedes importar el sitio desde Search Console.
   Bing alimenta también a DuckDuckGo y Ecosia.
3. **Cloudflare**: en *Security → Bots*, si usas *Bot Fight Mode*, comprueba en *Security → Events*
   que no bloquea a Googlebot ni a Bingbot (Cloudflare los reconoce como *verified bots*).
4. Comprueba un post en la **prueba de resultados enriquecidos** de Google
   (search.google.com/test/rich-results): debe detectar *Artículo* y *Ruta de navegación*.
5. Comprueba la vista previa al compartir con opengraph.xyz o el *Sharing Debugger* de Facebook.

El dominio de las URLs canónicas, el sitemap y el feed sale del ajuste **Configuración → Sitio →
Dominio** del panel (`site_domain`). Si cambias de dominio, actualízalo ahí.
