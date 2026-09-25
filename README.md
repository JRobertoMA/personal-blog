# jrobertoma.com

Blog personal con estética de sistema operativo en escritorio y un lector táctil en móvil.
Frontend React (compilado con esbuild) + API PHP/MariaDB, pensado para hosting compartido (IONOS).

- `src/` — código fuente JSX. Compila con `npm install && npm run build`.
- `assets/` — CSS y JS compilado que se sube al servidor.
- `api/` — API PHP (router en `api/index.php`).
- `schema.sql` — estructura y datos de ejemplo.
- `docs/ANALISIS.md` — análisis de seguridad, UX y UI.
- `docs/DESPLIEGUE.md` — guía para subirlo a IONOS.
- `docs/CLOUDFLARE.md` — HTTPS con Cloudflare delante de IONOS (modo Flexible, regla y Access).
