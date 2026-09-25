<?php
declare(strict_types=1);

// Página "Sobre mí": un documento JSON en settings.about_page.
// GET /api/about — público (lo usan la web y el panel)
// PUT /api/about — solo administrador, reemplaza el documento completo

$method = $GLOBALS['_METHOD'];
$body   = $GLOBALS['_BODY'];
$db     = getDB();

const ABOUT_KEY = 'about_page';

// Contenido inicial: lo que había escrito a mano en la web antes de ser editable
function aboutDefaults(): array {
    return [
        'name'     => 'J. Roberto M.',
        'initials' => 'JR',
        'role'     => 'Software dev · Tinkerer · Curioso profesional',
        'subtitle' => 'jrobertoma.com',
        'avatar'   => '',
        'bio'      => "Programador, entusiasta del hardware y del open source. Escribo sobre lo que aprendo —software, sistemas, videojuegos y de vez en cuando lo que no entra en ninguna de esas categorías.\n\n"
                    . 'Este sitio es mi escritorio. Las ventanas se mueven, la terminal funciona, y los posts viven dentro de un explorador. Si te gusta cacharrear con sistemas, probablemente te sientas en casa.',
        'stack'    => ['rust', 'typescript', 'python', 'linux', 'docker', 'postgres', 'vim', 'tmux'],
        'links'    => [
            ['label' => 'email',    'text' => 'hola@jrobertoma.com',     'url' => 'mailto:hola@jrobertoma.com'],
            ['label' => 'github',   'text' => '@jrobertoma',             'url' => 'https://github.com/jrobertoma'],
            ['label' => 'mastodon', 'text' => '@jrobertoma@hachyderm.io', 'url' => 'https://hachyderm.io/@jrobertoma'],
            ['label' => 'rss',      'text' => 'jrobertoma.com/feed.xml', 'url' => ''],
        ],
    ];
}

function loadAbout(PDO $db): array {
    $stmt = $db->prepare('SELECT value FROM settings WHERE key_name = ?');
    $stmt->execute([ABOUT_KEY]);
    $raw  = $stmt->fetchColumn();
    $data = is_string($raw) ? json_decode($raw, true) : null;
    return is_array($data) ? array_merge(aboutDefaults(), $data) : aboutDefaults();
}

// Texto de una línea: sin caracteres de control, recortado a $max caracteres
function aboutText(mixed $value, int $max, bool $multiline = false): string {
    $s = is_string($value) ? $value : '';
    $s = str_replace("\r\n", "\n", $s);
    $s = preg_replace($multiline ? '/[\x00-\x08\x0B-\x1F\x7F]/u' : '/[\x00-\x1F\x7F]/u', '', $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}

// Solo http(s) y mailto: nunca javascript:, data:, etc.
function aboutUrl(mixed $value, string $field): string {
    $url = aboutText($value, 300);
    if ($url === '') return '';
    if (!preg_match('#^(https?://[^\s]+|mailto:[^\s@]+@[^\s@]+)$#i', $url)) {
        respond(false, "La URL de «{$field}» debe empezar por https:// o mailto:", 400);
    }
    return $url;
}

if ($method === 'GET') {
    respond(true, loadAbout($db));
}

requireAuth();

if ($method === 'PUT') {
    verifyCsrf();

    $name = aboutText($body['name'] ?? '', 120);
    if ($name === '') respond(false, 'El nombre es obligatorio', 400);

    // Avatar: solo imágenes subidas desde Multimedia (misma URL que devuelve /api/media)
    $avatar = aboutText($body['avatar'] ?? '', 200);
    if ($avatar !== '' && !preg_match('#^uploads/media/[a-f0-9]{16,64}\.(jpg|png|gif|webp)$#', $avatar)) {
        respond(false, 'La foto debe ser una imagen de Multimedia', 400);
    }

    $stack = [];
    foreach ((array)($body['stack'] ?? []) as $item) {
        $item = aboutText($item, 40);
        if ($item !== '' && !in_array($item, $stack, true)) $stack[] = $item;
    }
    if (count($stack) > 40) respond(false, 'Máximo 40 elementos en el stack', 400);

    $links = [];
    foreach ((array)($body['links'] ?? []) as $i => $link) {
        if (!is_array($link)) continue;
        $label = aboutText($link['label'] ?? '', 30);
        $text  = aboutText($link['text'] ?? '', 120);
        if ($label === '' && $text === '') continue; // fila vacía
        if ($label === '' || $text === '') respond(false, 'Cada contacto necesita etiqueta y texto', 400);
        $links[] = ['label' => $label, 'text' => $text, 'url' => aboutUrl($link['url'] ?? '', $label)];
    }
    if (count($links) > 12) respond(false, 'Máximo 12 contactos', 400);

    $about = [
        'name'     => $name,
        'initials' => mb_strtoupper(aboutText($body['initials'] ?? '', 3)),
        'role'     => aboutText($body['role'] ?? '', 200),
        'subtitle' => aboutText($body['subtitle'] ?? '', 120),
        'avatar'   => $avatar,
        'bio'      => aboutText($body['bio'] ?? '', 10000, true),
        'stack'    => $stack,
        'links'    => $links,
    ];

    $json = json_encode($about, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || !fitsSettingsValue($json)) {
        respond(false, '«Sobre mí» es demasiado largo: acorta la bio (el máximo total es 64 KB)', 400);
    }
    $db->prepare('INSERT INTO settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)')
       ->execute([ABOUT_KEY, $json]);

    respond(true, $about);
}

respond(false, 'Método no permitido', 405);
