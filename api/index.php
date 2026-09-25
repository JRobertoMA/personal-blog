<?php
// Nunca mostrar errores al visitante: una excepción de PDO puede incluir
// credenciales en la traza. Se registran en el log del servidor.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

session_name('jros_admin');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => $isHttps,
    'httponly' => true,
    'samesite' => 'Strict',
]);
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');

// Solo abrimos sesión si el visitante ya trae cookie o va a iniciar sesión;
// así los lectores anónimos no generan una sesión por visita.
$uriPath = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
if (isset($_COOKIE[session_name()]) || preg_match('#/auth/login/?$#', $uriPath)) {
    session_start();
}

require __DIR__ . '/config/database.php';
require __DIR__ . '/middleware/auth.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(bool $ok, $data = null, int $code = 200): void {
    http_response_code($code);
    echo json_encode($ok
        ? ['ok' => true,  'data'  => $data]
        : ['ok' => false, 'error' => $data]
    );
    exit;
}

set_exception_handler(function (Throwable $e) {
    error_log('[jrobertoma api] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    respond(false, 'Error interno del servidor', 500);
});

$uri = $uriPath;
$uri = preg_replace('#^.*?/api(?=/|$)#', '', $uri); // quitar prefijo (subcarpeta) hasta /api
$uri = rtrim($uri, '/') ?: '/';

$method   = $_SERVER['REQUEST_METHOD'];
$segments = array_values(array_filter(explode('/', ltrim($uri, '/')), 'strlen'));
$segments = array_map('rawurldecode', $segments);

$resource = $segments[0] ?? null;
$id       = $segments[1] ?? null;
$sub      = $segments[2] ?? null;

$GLOBALS['_METHOD']   = $method;
$GLOBALS['_RESOURCE'] = $resource;
$GLOBALS['_ID']       = $id;
$GLOBALS['_SUB']      = $sub;

$rawBody = file_get_contents('php://input');
if (strlen($rawBody) > 2 * 1024 * 1024 && !str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/')) {
    respond(false, 'Petición demasiado grande', 413);
}
$decoded = $rawBody ? json_decode($rawBody, true) : [];
$GLOBALS['_BODY'] = is_array($decoded) ? $decoded : [];

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
    case 'about':       require __DIR__ . '/handlers/about.php';      break;
    case 'notes':       require __DIR__ . '/handlers/notes.php';      break;
    default:
        respond(false, 'Ruta no encontrada', 404);
}
