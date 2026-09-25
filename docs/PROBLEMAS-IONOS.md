# Problemas al desplegar en IONOS y cómo se resolvieron

Registro de los fallos encontrados al poner `jrobertoma.com` en producción (IONOS, hosting compartido, con
Cloudflare delante) y de cómo diagnosticarlos si vuelven a aparecer. Todos se reprodujeron o verificaron antes de
corregirse.

Para el HTTPS y la configuración de Cloudflare, ver [CLOUDFLARE.md](CLOUDFLARE.md). Para los pasos de
despliegue, [DESPLIEGUE.md](DESPLIEGUE.md).

## Resumen

| Síntoma | Causa | Solución |
|---|---|---|
| `POST /api/auth/login` → **404** (página de error de Apache) y rutas inventadas → **500** | IONOS resuelve mal las `RewriteRule` con destino relativo cuando el dominio apunta a una carpeta | `.htaccess` con rutas absolutas y `%{ENV:BASE}` |
| `/api/posts`, `/api/about`… → **500** `"Error interno del servidor"` | Contraseña de la BD con `"` y `#` dentro de un valor entre comillas dobles en el `.env`: se leía recortada | `DB_PASS` entre **comillas simples** (y lector del `.env` más tolerante) |
| No se ve el motivo de un 500 | IONOS no da acceso al log de errores de PHP | `LOG_FILE` en el `.env` |

---

## 1. La API da 404 y las rutas de la web dan 500

**Síntomas** (todo lo demás cargaba: `admin.html`, `assets/app.js`, cabeceras de seguridad):

```
POST https://jrobertoma.com/api/auth/login   → 404  (página "Error 404!" de Apache, no JSON)
GET  https://jrobertoma.com/una-ruta         → 500  (debería servir index.html)
GET  https://jrobertoma.com/api/index.php    → 404  pero en JSON: PHP sí se ejecuta
```

**Causa.** En IONOS el dominio apunta a una **carpeta** del espacio web, pero para Apache la raíz es el espacio
web entero. Una `RewriteRule` con destino **relativo** (`api/index.php`, `index.html`) se resuelve contra esa
raíz y apunta a una ruta que no existe:

- la regla de la API usa `[END]` → no se vuelve a procesar → **404**;
- el fallback de la web usaba `[L]` → se reprocesa en bucle → **500** (demasiadas redirecciones internas).

En Docker local no pasa porque ahí la raíz de Apache y la carpeta del proyecto coinciden.

**Solución** (en [`.htaccess`](../.htaccess)). La solución típica de IONOS es `RewriteBase /`, pero rompe la copia
local, que vive en `/personal-blog/`. En su lugar se calcula la carpeta base desde la propia URL (técnica del
`.htaccess` de Symfony) y se reescribe siempre a rutas **absolutas**:

```apache
RewriteCond %{REQUEST_URI}::$0 ^(/.+)/(.*)::\2$
RewriteRule .* - [E=BASE:%1]          # "" en el dominio, "/personal-blog" en local

RewriteRule ^api(/.*)?$ %{ENV:BASE}/api/index.php [END,QSA]
RewriteRule ^ %{ENV:BASE}/index.html [END]
```

**Verificado** con un Apache temporal configurado como IONOS (raíz en el espacio web, dominio apuntando a una
carpeta mediante `Alias`): el `.htaccess` anterior daba exactamente 404 en la API y 500 en las rutas; el
corregido, 200/401 donde corresponde. Un primer intento con `VirtualDocumentRoot` **no** reproducía el fallo:
no es esa la causa.

---

## 2. La API da 500 con "Error interno del servidor"

**Síntomas.** `/api/posts`, `/api/about` y `/api/notes` → 500. `/api/auth/me` → 401 normal: PHP funciona y solo
falla lo que usa la base de datos.

**Diagnóstico.** El log de `LOG_FILE` (ver [sección 3](#3-ver-los-errores-de-la-api-en-ionos)) mostró:

```
No se pudo conectar a la base de datos: SQLSTATE[HY000] [1045] Access denied for user 'dbuXXXXXXX'@'infong-XXXX.perfora.net' (using password: YES)
```

`1045 … using password: YES` significa que el servidor y el usuario son correctos pero la **contraseña no**.
Comparando lo que leía la API con el texto del `.env` (sin mostrarlo): el `.env` tenía la contraseña entre
comillas dobles y la contraseña **contenía una comilla doble y una `#`**:

```
DB_PASS="abc"def#ghi"      ← la API leía solo  abc
```

**Solución aplicada.** Comillas **simples** en el `.env` del servidor:

```
DB_PASS='abc"def#ghi'
```

Además, el lector del `.env` ([api/config/database.php](../api/config/database.php), `parseEnvFile()`) ahora
toma lo que hay entre la primera y la **última** comilla doble cuando todo el valor va entre comillas, así que el
caso anterior también funcionaría.

### Reglas para escribir valores en el `.env`

| La contraseña contiene… | Cómo escribirla |
|---|---|
| Solo letras, números y `-_.` | Sin comillas: `DB_PASS=abc123` |
| `#`, `;`, espacios, `$`, `!`, `(`… | Entre comillas: `DB_PASS='a#b c'` |
| Comilla doble `"` | Comillas **simples**: `DB_PASS='a"b'` |
| Comilla simple `'` | Comillas dobles: `DB_PASS="a'b"` |
| Ambas comillas | Dobles, escapando la doble: `DB_PASS="a'b\"c"` |

- Los comentarios del `.env` van en líneas propias que empiezan por `;` o `#`.
- Sin comillas, un ` #` o ` ;` precedido de espacio inicia un comentario al final de la línea.
- El lector **no** es `parse_ini_file()`: esa función de PHP fallaba con comentarios `#` y paréntesis y
  descartaba el `.env` entero (fue el primer error en local).

---

## 3. Ver los errores de la API en IONOS

La API nunca muestra el detalle de un error al visitante (podría contener datos de conexión): responde
`"Error interno del servidor"` y anota el motivo en un log. En hosting compartido IONOS **no da acceso** al log de
PHP (la carpeta `logs/` del espacio web solo tiene accesos), así que:

1. Añade al `.env` del servidor:
   ```
   LOG_FILE=personal-blog-errors.log
   ```
   Una ruta relativa se guarda **junto al `.env`**, fuera de la carpeta pública del dominio.
2. Reproduce el error (abre la URL que falla).
3. Lee `personal-blog-errors.log` en la raíz del espacio web (SFTP).

Solo se escribe cuando hay errores, así que puede quedarse activado. Formato de cada línea:

```
[2026-09-24 21:37:50] [jrobertoma api] <mensaje> @ <carpeta/archivo.php>:<línea>
```

### Errores habituales en el log

| Mensaje | Qué revisar |
|---|---|
| `[1045] Access denied … (using password: YES)` | Contraseña o comillas del `DB_PASS` (sección 2) |
| `[1045] … (using password: NO)` | `DB_PASS` vacío o el `.env` no se encuentra |
| `[2002] Connection refused` / `No such file or directory` | `DB_HOST` (en IONOS es `dbXXXXXXXXX.hosting-data.io`) |
| `[1049] Unknown database` | `DB_NAME` |
| `Table '…' doesn't exist` | Falta importar [schema.sql](../schema.sql) en phpMyAdmin |
| `No se encontró un .env válido con DB_NAME` | El `.env` no está en la raíz del espacio web o le falta `DB_NAME` |

---

## Checklist rápido tras desplegar

```bash
D=https://jrobertoma.com
curl -s  $D/api/posts   | head -c 80   # {"ok":true,...}
curl -s  $D/api/auth/me                 # {"ok":false,"error":"No autenticado"}  (401, correcto)
curl -so /dev/null -w "%{http_code}\n" $D/una-ruta-inventada   # 200 (sirve la web)
curl -so /dev/null -w "%{http_code}\n" $D/.env                 # 403
curl -sI $D/ | grep -i content-security-policy                 # debe aparecer
```

Si `/api/posts` devuelve `"categories":[]`, la base de datos no tiene categorías: créalas en
**panel › Categorías/Tags** (el editor de posts exige elegir una) o importa las de ejemplo de `schema.sql`.
