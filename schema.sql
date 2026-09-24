-- jrobertoma.com — MariaDB Schema
-- Run this in phpMyAdmin or: mysql -u root -p jrobertoma < schema.sql

SET NAMES utf8mb4;
SET foreign_key_checks = 0;

-- ─── Tables ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(80) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id          VARCHAR(50) PRIMARY KEY,
  label       VARCHAR(100) NOT NULL,
  description TEXT,
  color       VARCHAR(7)  DEFAULT '#39ff14',
  sort_order  INT DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS posts (
  id           VARCHAR(60) PRIMARY KEY,
  title        VARCHAR(300) NOT NULL,
  body         LONGTEXT NOT NULL,
  excerpt      TEXT,
  category_id  VARCHAR(50) NOT NULL,
  status       ENUM('published','draft','scheduled') DEFAULT 'draft',
  date         DATE NOT NULL,
  scheduled_at DATETIME,
  views        INT DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tags (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS post_tags (
  post_id VARCHAR(60),
  tag_id  INT,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comments (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  post_id      VARCHAR(60) NOT NULL,
  author_name  VARCHAR(120) NOT NULL,
  author_email VARCHAR(200),
  body         TEXT NOT NULL,
  status       ENUM('pending','approved','spam') DEFAULT 'pending',
  ip_address   VARCHAR(45),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  sender_name  VARCHAR(120) NOT NULL,
  sender_email VARCHAR(200) NOT NULL,
  subject      VARCHAR(300),
  body         TEXT NOT NULL,
  is_read      TINYINT(1) DEFAULT 0,
  is_archived  TINYINT(1) DEFAULT 0,
  ip_address   VARCHAR(45),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS media (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  filename      VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100),
  size_bytes    INT,
  width         INT,
  height        INT,
  uploaded_at   DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS settings (
  key_name   VARCHAR(100) PRIMARY KEY,
  value      TEXT,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pageviews (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  post_id     VARCHAR(60),
  viewed_date DATE NOT NULL,
  views       INT DEFAULT 1,
  UNIQUE KEY daily_post (post_id, viewed_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS login_attempts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  ip_address   VARCHAR(45) NOT NULL,
  attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip_time (ip_address, attempted_at)
) ENGINE=InnoDB;

-- ─── Usuario administrador ────────────────────────────────────────
-- No se incluye ninguna contraseña por defecto. Genera tu hash en local:
--   php -r 'echo password_hash("TU_CONTRASEÑA_LARGA", PASSWORD_DEFAULT), PHP_EOL;'
-- y ejecuta en phpMyAdmin (elige un usuario que no sea "admin"):
--   INSERT INTO admin_users (username, password_hash) VALUES ('tu_usuario', 'PEGA_AQUI_EL_HASH');

-- ─── Categories ───────────────────────────────────────────────────
INSERT IGNORE INTO categories (id, label, description, color, sort_order) VALUES
  ('linux',      'Linux & Kernel',     'Compilación, módulos, distros y todo lo que vive bajo /proc', '#39ff14', 1),
  ('dev',        'Desarrollo',         'Código, herramientas y filosofía de software', '#00f0ff',  2),
  ('hardware',   'Hardware',           'Electrónica, SBCs y cacharreo físico', '#ff00d4',          3),
  ('seguridad',  'Seguridad',          'CTFs, hardening y análisis de vulnerabilidades', '#ffb800', 4),
  ('retro',      'Retro & Historia',   'Arqueología digital y nostalgia computacional', '#ff4500',  5),
  ('filosofia',  'Filosofía Tech',     'Reflexiones sobre tecnología, privacidad y sociedad', '#a855f7', 6);

-- ─── Sample posts ─────────────────────────────────────────────────
INSERT IGNORE INTO posts (id, title, excerpt, body, category_id, status, date) VALUES
  ('compilando-kernel',
   'Compilando el kernel de Linux desde cero en 2025',
   'Una guía paso a paso para compilar tu propio kernel. Desde el .config hasta el grub.',
   '## Por qué compilar el kernel\n\nCompilación propia del kernel te permite habilitar características experimentales, quitar bloat, y entender más profundamente cómo funciona Linux.\n\n## Requisitos\n\n```bash\nsudo apt install build-essential libncurses-dev bison flex libssl-dev libelf-dev\n```\n\n## Descarga las fuentes\n\n```bash\nwget https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-6.8.tar.xz\ntar xf linux-6.8.tar.xz && cd linux-6.8\n```\n\n## Configuración\n\n```bash\nmake menuconfig\n```\n\nElige las opciones relevantes para tu hardware. Un truco útil: copia la config del kernel actual con `zcat /proc/config.gz > .config` y luego ejecuta `make olddefconfig`.\n\n## Compilar e instalar\n\n```bash\nmake -j$(nproc)\nsudo make modules_install\nsudo make install\nsudo update-grub\n```\n\nReinicia y selecciona el nuevo kernel desde GRUB. ¡Bienvenido al club!',
   'linux', 'published', '2026-04-28'),

  ('rust-en-kernel',
   'Rust en el kernel de Linux: estado actual y controversias',
   'Linus acepta Rust. La comunidad C lleva 30 años. ¿Quién tiene razón?',
   '## El debate\n\nDesde que Linus Torvalds aceptó los primeros módulos en Rust en Linux 6.1, el debate sobre si esto es una buena idea no ha parado.\n\n## El argumento a favor\n\nRust elimina clases enteras de bugs de memoria: use-after-free, double-free, data races. En código de kernel esto no es trivial — son exactamente los bugs que producen CVEs críticos.\n\n## El argumento en contra\n\nEl toolchain de Rust es complejo, la curva de aprendizaje es empinada para contribuidores de C, y la interoperabilidad C/Rust tiene sus fricciones.\n\n## Mi opinión\n\nAmbas partes tienen razón. Rust no va a reescribir el kernel, pero sí puede proteger los subsistemas nuevos. El driver de GPU Nova (en Rust) es el experimento más interesante a seguir.',
   'linux', 'published', '2026-04-21'),

  ('btrfs-vs-ext4',
   'Btrfs vs ext4 en 2025: ¿ya es hora de migrar?',
   'Snapshots, compresión transparente y RAID por software. Btrfs promete mucho. ¿Cumple?',
   '## El contexto\n\nExt4 lleva siendo el sistema de archivos por defecto en la mayoría de distros desde 2008. Es estable, predecible y bien soportado. Btrfs tiene características avanzadas pero su historia ha sido accidentada.\n\n## Lo que Btrfs hace bien\n\n- **Snapshots atómicos**: ideal para rollbacks antes de actualizaciones\n- **Compresión transparente**: zstd puede ahorrar 30-40% de espacio en código/texto\n- **Subvolúmenes**: separar `/home` y `/` sin particiones separadas\n\n## Lo que sigue siendo problemático\n\n- RAID 5/6 aún tiene bugs conocidos. No lo uses para datos importantes.\n- El `balance` puede tardar horas en discos grandes.\n\n## Veredicto\n\nPara un desktop con un solo disco: Btrfs en 2025 es sólido. Para servidores con RAID: ext4 o XFS todavía.',
   'linux', 'published', '2026-04-14'),

  ('neovim-config',
   'Mi configuración de Neovim en 2025: de cero a IDE',
   'LSP, Treesitter, Telescope y Lazy.nvim. Todo lo necesario y nada más.',
   '## Por qué Neovim\n\nNo es el editor más fácil, pero una vez que tus dedos aprenden los movimientos, programar en cualquier otra herramienta se siente lento.\n\n## El stack\n\n- **lazy.nvim**: gestor de plugins moderno\n- **nvim-lspconfig**: Language Server Protocol\n- **nvim-treesitter**: syntax highlighting preciso\n- **telescope.nvim**: fuzzy finder para todo\n- **conform.nvim**: formateo automático al guardar\n\n## El archivo init.lua mínimo\n\n```lua\nvim.opt.number = true\nvim.opt.relativenumber = true\nvim.opt.expandtab = true\nvim.opt.shiftwidth = 2\n```\n\nEl truco está en ir añadiendo cosas solo cuando las necesitas, no instalar 40 plugins el día uno.',
   'dev', 'published', '2026-04-10'),

  ('ctf-pwn-intro',
   'Introducción al pwn en CTFs: buffer overflows sin miedo',
   'Stack smashing, ROP chains y pwntools. Primeros pasos en explotación binaria.',
   '## ¿Qué es el pwn?\n\nEn la jerga CTF, "pwn" (pronunciado como "pone" o "pown") se refiere a la explotación de binarios: encontrar vulnerabilidades en programas compilados y conseguir ejecución de código arbitrario.\n\n## La base: el stack\n\nEl stack es una región de memoria LIFO. Cuando llamas una función, se apila el return address. Si puedes escribir más allá del buffer local, puedes sobreescribir ese return address.\n\n## Herramientas\n\n```bash\npip install pwntools\n```\n\n```python\nfrom pwn import *\np = process(\"./vulnerable\")\npayload = b\"A\" * 72 + p64(0xdeadbeef)\np.sendline(payload)\np.interactive()\n```\n\n## Por dónde empezar\n\npicoCTF tiene challenges de pwn para principiantes excelentes. También recomiendo el wargame "protostar" de exploit.education.',
   'seguridad', 'published', '2026-04-05'),

  ('raspberry-pi-router',
   'Convierte tu Raspberry Pi en un router con firewall',
   'nftables, hostapd y dnsmasq. Un router casero que realmente controlas.',
   '## Materiales\n\n- Raspberry Pi 4 (2GB RAM suficiente)\n- Adaptador WiFi USB con modo AP (recomiendo Alfa AWUS036ACM)\n- Tarjeta microSD de al menos 16GB\n\n## El plan\n\nLa Pi tendrá dos interfaces: `eth0` conectada al módem del ISP, y `wlan0` configurada como punto de acceso. nftables hará el NAT.\n\n## Configurar hostapd\n\n```\ninterface=wlan0\nssid=MiRedCasera\nhw_mode=g\nchannel=7\nwpa=2\nwpa_passphrase=SuperSecreta123\n```\n\n## nftables básico\n\n```\ntable ip nat {\n  chain postrouting {\n    type nat hook postrouting priority 100;\n    oifname \"eth0\" masquerade\n  }\n}\n```\n\nCon esto tienes un router funcional. El siguiente paso es añadir filtrado DNS con Pi-hole.',
   'hardware', 'published', '2026-03-28'),

  ('unix-filosofia',
   'La filosofía Unix 50 años después: ¿sigue vigente?',
   '"Haz una cosa y hazla bien." ¿Aplica este principio en la era de los microservicios?',
   '## Los principios\n\nEn 1978, Doug McIlroy resumió la filosofía Unix en tres reglas:\n\n1. Escribe programas que hagan una cosa y la hagan bien.\n2. Escribe programas que colaboren con otros.\n3. Escribe programas que manejen texto, porque es una interfaz universal.\n\n## La trampa de los pipes\n\nLa composabilidad de Unix es hermosa en teoría. En práctica, `curl | grep | awk | sed` produce scripts que nadie puede mantener tres meses después.\n\n## Microservicios como Unix distribuido\n\nHay una analogía directa: los microservicios aplican "haz una cosa" a servicios de red. El problema es que añaden latencia de red donde antes había IPC.\n\n## Mi conclusión\n\nEl principio sigue siendo válido, pero necesita contexto. "Una cosa" en 2025 puede ser un servicio complejo. Lo que importa es que la interfaz sea predecible.',
   'filosofia', 'published', '2026-03-20'),

  ('c64-demoscene',
   'La demoscene del C64: arte en 64KB',
   'Cómo los crackers de los 80 inventaron una forma de arte que sigue viva.',
   '## Qué es la demoscene\n\nUna "demo" es un programa no interactivo que muestra efectos visuales y música generados en tiempo real, todo dentro de restricciones de memoria y CPU externas.\n\n## El Commodore 64\n\nEl C64 tiene 64KB de RAM, un procesador a 1MHz y el chip de sonido SID. Con estas restricciones, los demosceners lograron efectos que parecen imposibles: scrollers en raster, sprites multiplexados, música compleja.\n\n## El rastro cultural\n\nMuchos programadores de videojuegos de los 90 (incluyendo gente de id Software) venían de la demoscene europea. La obsesión por el rendimiento, el conocimiento del metal desnudo, la cultura de competencia técnica: todo viene de ahí.\n\n## Hoy\n\nLa demoscene sigue activa. Cada año se celebran parties como Revision en Alemania. En 2020, la UNESCO declaró la demoscene patrimonio cultural inmaterial en Finlandia.',
   'retro', 'published', '2026-03-12');

-- ─── Default settings ─────────────────────────────────────────────
INSERT IGNORE INTO settings (key_name, value) VALUES
  ('profile_name',        'J. Roberto M.'),
  ('profile_email',       'jroberto.ma@outlook.com'),
  ('profile_bio',         'Sysadmin, programador y entusiasta del hardware retro.'),
  ('site_title',          'jrobertoma.com'),
  ('site_description',    'Un blog que se siente como un sistema operativo.'),
  ('site_domain',         'jrobertoma.com'),
  ('site_posts_per_page', '10'),
  ('social_github',       'https://github.com/jrobertoma'),
  ('comments_enabled',    '1'),
  ('rss_enabled',         '1');

SET foreign_key_checks = 1;
