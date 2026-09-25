<?php
declare(strict_types=1);

// Ventana "Notas" del escritorio: texto plano en settings.notes_page.
// Sintaxis por líneas (la interpreta src/notes.js):
//   # título   → encabezado con ★ ({hoy} = fecha del día)
//   - texto    → elemento de lista
//   > texto    → anotación "a mano"
// GET /api/notes — público · PUT /api/notes — solo administrador

$method = $GLOBALS['_METHOD'];
$body   = $GLOBALS['_BODY'];
$db     = getDB();

const NOTES_KEY = 'notes_page';
const NOTES_MAX = 20000;

// Contenido inicial: lo que había escrito a mano en la web antes de ser editable
const NOTES_DEFAULT = <<<TXT
# NOTAS PERSONALES — {hoy}

- terminar post sobre tmux antes del viernes
- investigar por qué el ventilador hace ruido a 3000 rpm
> (probable: cable EPS rozando el aspa)

# ideas que pueden ser posts
- ¿es razonable correr Postgres en una raspberry pi 5?
- historia de los terminales: de VT100 al emulador moderno
- nftables vs iptables: cuándo migrar

# pendientes
- actualizar la pi a bookworm
- montar raid1 en el NAS
> (comprar dos discos de 4TB antes de que suban de precio)
TXT;

if ($method === 'GET') {
    $stmt = $db->prepare('SELECT value FROM settings WHERE key_name = ?');
    $stmt->execute([NOTES_KEY]);
    $text = $stmt->fetchColumn();
    respond(true, ['text' => is_string($text) ? $text : NOTES_DEFAULT]);
}

requireAuth();

if ($method === 'PUT') {
    verifyCsrf();

    $text = $body['text'] ?? null;
    if (!is_string($text)) respond(false, 'Falta el texto de las notas', 400);
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $text = preg_replace('/[\x00-\x08\x0B-\x1F\x7F]/u', '', $text) ?? '';
    $text = rtrim($text);
    if (mb_strlen($text) > NOTES_MAX) respond(false, 'Las notas no pueden superar ' . NOTES_MAX . ' caracteres', 400);
    if (!fitsSettingsValue($text)) {
        respond(false, 'Las notas son demasiado largas: ocupan ' . number_format(strlen($text), 0, ',', '.')
            . ' bytes y el máximo es ' . number_format(SETTINGS_VALUE_MAX_BYTES, 0, ',', '.') . ' (cada emoji ocupa 4 bytes; una letra, 1)', 400);
    }

    $db->prepare('INSERT INTO settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)')
       ->execute([NOTES_KEY, $text]);

    respond(true, ['text' => $text]);
}

respond(false, 'Método no permitido', 405);
