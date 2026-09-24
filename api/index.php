<?php
session_name('jros_admin');
session_start();

require __DIR__ . '/config/database.php';
require __DIR__ . '/middleware/auth.php';

header('Content-Type: application/json; charset=utf-8');

$uri = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
$uri = preg_replace('#^/[^/]+/api#', '', $uri); // strip subdir prefix if any
$uri = preg_replace('#^/api#', '', $uri);
$uri = rtrim($uri, '/') ?: '/';

$method   = $_SERVER['REQUEST_METHOD'];
$segments = array_values(array_filter(explode('/', ltrim($uri, '/'))));

$resource = $segments[0] ?? null;
$id       = $segments[1] ?? null;
$sub      = $segments[2] ?? null;

$GLOBALS['_METHOD']   = $method;
$GLOBALS['_RESOURCE'] = $resource;
$GLOBALS['_ID']       = $id;
$GLOBALS['_SUB']      = $sub;

$rawBody = file_get_contents('php://input');
$GLOBALS['_BODY'] = $rawBody ? (json_decode($rawBody, true) ?? []) : [];

function respond(bool $ok, $data = null, int $code = 200): void {
    http_response_code($code);
    echo json_encode($ok
        ? ['ok' => true,  'data'  => $data]
        : ['ok' => false, 'error' => $data]
    );
    exit;
}

switch ($resource) {
    case 'posts':       require __DIR__ . '/handlers/posts.php';      break;
    case 'categories':  require __DIR__ . '/handlers/categories.php'; break;
    case 'tags':        require __DIR__ . '/handlers/tags.php';       break;
    case 'comments':    require __DIR__ . '/handlers/comments.php';   break;
    case 'messages':    require __DIR__ . '/handlers/messages.php';   break;
    case 'media':       require __DIR__ . '/handlers/media.php';      break;
    case 'analytics':   require __DIR__ . '/handlers/analytics.php';  break;
    case 'settings':    require __DIR__ . '/handlers/settings.php';   break;
    case 'auth':        require __DIR__ . '/handlers/auth.php';       break;
    default:
        respond(false, 'Ruta no encontrada', 404);
}
