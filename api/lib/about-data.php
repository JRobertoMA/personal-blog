<?php
declare(strict_types=1);

// Datos de la página "Sobre mí" (documento JSON en settings.about_page).
// Compartido por la API (handlers/about.php) y el HTML para buscadores (page.php).

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
