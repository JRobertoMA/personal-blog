# Despliegue en IONOS (hosting compartido)

## 1. Compilar el frontend (en tu PC)

Solo hace falta si modificas algo en `src/`. Los archivos compilados ya van en el repo.

```bash
npm install
npm run build        # genera assets/app.js y assets/admin.js
npm run watch        # opcional: recompila al guardar mientras desarrollas
```

## 2. Base de datos

1. En el panel de IONOS: **Hosting → Bases de datos → Crear base de datos (MariaDB)**. Anota host (`dbXXXX.hosting-data.io`), nombre, usuario y contraseña.
2. Abre **phpMyAdmin** e importa `schema.sql`.
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
    ├── index.html
    ├── admin.html
    ├── api/              (con su .htaccess)
    ├── assets/           (styles.css, mobile.css, app.js, admin.js)
    └── uploads/          (con su .htaccess y uploads/media/)
```

En **Dominios y SSL → tu dominio → Destino**, apunta el dominio a `/blog`.

**No subas**: `src/`, `node_modules/`, `docs/`, `schema.sql`, `package*.json`, `build.mjs`, `.git/`.
(Están bloqueados por `.htaccess` por si acaso, pero es mejor que no estén.)

Copia `.env.example` como `.env`, rellena los datos de IONOS y súbelo a `/`.

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
- Abre la web en el móvil y comparte un post: el enlace `#/post/...` debe abrir directamente ese post.
