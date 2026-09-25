# SSL con Cloudflare delante de IONOS

Cómo servir `jrobertoma.com` por HTTPS cuando el hosting está en IONOS pero los DNS los gestiona Cloudflare.

## Contexto

| Pieza | Papel |
|---|---|
| **Hostinger** | Registrador: solo indica que los DNS los gestiona Cloudflare. |
| **Cloudflare** | Gestiona todos los registros DNS (los que se importaron de IONOS y los de los Tunnels). |
| **IONOS** | Aloja la web. Tiene `jrobertoma.com` añadido como dominio externo y asignado al espacio web. |

Los servidores de nombres **deben seguir en Cloudflare**: si se devuelven a IONOS, los Tunnels dejan de funcionar.

## El problema

Con los registros de `@` y `www` en **Solo DNS** (nube gris), el navegador habla directamente con IONOS, que
no tiene certificado para el dominio y corta la conexión. Firefox lo muestra como
`SSL_ERROR_INTERNAL_ERROR_ALERT` (alerta TLS 80). El "SSL automático" de Cloudflare solo se aplica a los registros
con proxy (nube naranja).

Opciones que **no** funcionan en esta configuración (comprobado):

- **Certificado de IONOS**: IONOS solo lo emite si el dominio usa sus servidores de nombres
  («El certificado SSL solo puede utilizarse para dominios que utilizan servidores de nombre IONOS»).
- **Origin Certificate de Cloudflare + Full (strict)**: IONOS no permite importar certificados propios.
- **Modo Full**: Cloudflare conectaría con IONOS por HTTPS, IONOS no tiene certificado y daría el error 525.

Queda el modo **Flexible**: cifrado entre el visitante y Cloudflare, y **sin cifrar** entre Cloudflare e IONOS.

## Configuración (aplicada y funcionando)

### 1. Regla de configuración solo para el blog

El modo SSL de *SSL/TLS → Descripción general* afecta a toda la zona. Para no romper otros subdominios con
proxy, se aplica solo al blog:

**Reglas → Regla de configuración → Crear regla**

- **Nombre**: `Blog IONOS – SSL Flexible`
- **Condición** (*Editar expresión*):
  ```
  (http.host in {"jrobertoma.com" "www.jrobertoma.com"})
  ```
- **Acciones**:
  - **SSL** → **Flexible**
  - **Rocket Loader** → **Desactivado**. Rocket Loader sirve los scripts desde un dominio de Cloudflare y la CSP del
    `.htaccess` (`script-src 'self'`) los bloquearía: la web se quedaría en la pantalla de carga.

El resto de acciones de la regla no se tocan.

Los Tunnels no se ven afectados por el modo SSL: la conexión con su origen la cifra `cloudflared`.

### 2. Proxy en los registros DNS

En **DNS → Registros**, poner en **nube naranja** (con proxy):

- `A` y `AAAA` de `jrobertoma.com`
- `A` y `AAAA` de `www`

Siguen apuntando a la IP de IONOS; Cloudflare es quien la usa como origen.

### 3. HTTPS forzado

**SSL/TLS → Certificados perimetrales → Usar siempre HTTPS**: activado.

### 4. Proteger el panel con Cloudflare Access

Con Flexible, la contraseña del panel viajaría sin cifrar entre Cloudflare e IONOS. Access hace que nadie llegue
siquiera al formulario de login sin identificarse antes.

**Zero Trust → Access → Applications → Add an application → Self-hosted**

- **Dominio**: `jrobertoma.com`, rutas `admin.html` y `api/auth/*`
- **Política**: *Allow*, con el email del administrador
- Cloudflare pedirá un código enviado a ese email antes de mostrar el panel.

Como segunda capa, se puede proteger además `admin.html` con la *Protección de directorios* de IONOS.

## Verificación

```bash
curl -sI https://jrobertoma.com/ | grep -iE "^HTTP|^server"   # HTTP/2 200 · server: cloudflare
curl -sI http://jrobertoma.com/  | grep -iE "^HTTP|^location" # 301 → https://jrobertoma.com/
dig +short A jrobertoma.com                                   # IPs de Cloudflare, no la de IONOS
```

Con el proyecto completo subido, comprobar también que el `.htaccess` está activo:

```bash
curl -sI https://jrobertoma.com/ | grep -i content-security-policy   # debe aparecer
curl -s -o /dev/null -w "%{http_code}\n" https://jrobertoma.com/.env  # 403
```

## Cómo encaja con el código

- **Redirección a HTTPS del [.htaccess](../.htaccess)**: IONOS recibe la petición por HTTP, pero Cloudflare añade
  `X-Forwarded-Proto: https` y el `.htaccess` la tiene en cuenta, así que no hay bucle de redirecciones.
- **Cookie de sesión**: [api/index.php](../api/index.php) la marca `Secure` por la misma cabecera.
- **HSTS**: no activarlo (ni en Cloudflare ni en el `.htaccess`) hasta que todo lleve un tiempo funcionando
  por HTTPS. Si algo se rompe con HSTS activo, los navegadores recuerdan la configuración durante meses.

## Inconsistencia conocida

Con el proxy activo, PHP ve la IP de Cloudflare en `REMOTE_ADDR`, no la del visitante. `clientIp()` en
[api/config/database.php](../api/config/database.php) todavía usa `REMOTE_ADDR`, así que los límites por IP
(5 intentos de login, comentarios y formulario de contacto) agrupan a muchos visitantes bajo unas pocas IPs de
Cloudflare. Hay que cambiarlo para que use `CF-Connecting-IP`, aceptándola **solo** cuando la petición llega desde
un rango oficial de Cloudflare (si no, cualquiera podría falsificarla).

## Si algún día cambia la situación

Si IONOS permite importar certificados o se consigue uno en el origen, cambiar la regla a **Full (strict)**:
todo el trayecto iría cifrado y Access dejaría de ser imprescindible (aunque sigue siendo recomendable).
