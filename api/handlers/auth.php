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
    $ip       = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    checkLoginRateLimit($ip);

    if (!$username || !$password) respond(false, 'Usuario y contraseña requeridos', 400);

    $db   = getDB();
    $stmt = $db->prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        recordLoginAttempt($ip);
        respond(false, 'Credenciales incorrectas', 401);
    }

    session_regenerate_id(true);
    $_SESSION['admin_id']       = $user['id'];
    $_SESSION['admin_username'] = $user['username'];

    respond(true, ['username' => $user['username'], 'csrf_token' => csrfToken()]);
}

// POST /api/auth/logout
if ($method === 'POST' && $id === 'logout') {
    session_destroy();
    respond(true, null);
}

respond(false, 'Método no permitido', 405);
