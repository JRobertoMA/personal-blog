<?php
$method = $GLOBALS['_METHOD'];
$id     = $GLOBALS['_ID'];
$body   = $GLOBALS['_BODY'];

// GET /api/auth/me
if ($method === 'GET' && $id === 'me') {
    if (isAdmin()) {
        respond(true, ['username' => $_SESSION['admin_username'] ?? 'admin', 'csrf_token' => csrfToken()]);
    }
    respond(false, 'No autenticado', 401);
}

// POST /api/auth/login
if ($method === 'POST' && $id === 'login') {
    $ip       = clientIp();
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    checkLoginRateLimit($ip);

    if (!is_string($username) || !is_string($password) || !$username || !$password) {
        respond(false, 'Usuario y contraseña requeridos', 400);
    }

    $db   = getDB();
    $stmt = $db->prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    // Hash ficticio para que el tiempo de respuesta no revele si el usuario existe
    $hash = $user['password_hash'] ?? '$2y$12$HV3Yfb0T0NIMpgL3K/G3luwgQgMLAMI.74UyK2cDr0ooYoomRMLg6';
    if (!password_verify($password, $hash) || !$user) {
        recordLoginAttempt($ip);
        respond(false, 'Credenciales incorrectas', 401);
    }

    session_regenerate_id(true);
    $_SESSION = [];
    $_SESSION['admin_id']       = $user['id'];
    $_SESSION['admin_username'] = $user['username'];

    respond(true, ['username' => $user['username'], 'csrf_token' => csrfToken()]);
}

// POST /api/auth/logout
if ($method === 'POST' && $id === 'logout') {
    if (isAdmin()) verifyCsrf();
    if (session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION = [];
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
        session_destroy();
    }
    respond(true, null);
}

respond(false, 'Método no permitido', 405);
