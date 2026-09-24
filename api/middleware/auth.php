<?php
function isAdmin(): bool {
    return !empty($_SESSION['admin_id']);
}

function requireAuth(): void {
    if (!isAdmin()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'No autorizado']);
        exit;
    }
}

function csrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($GLOBALS['_BODY']['csrf_token'] ?? '');
    if (!hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Token CSRF inválido']);
        exit;
    }
}

function checkLoginRateLimit(string $ip): void {
    $db = getDB();
    $stmt = $db->prepare(
        "SELECT COUNT(*) FROM login_attempts
         WHERE ip_address = ? AND attempted_at > NOW() - INTERVAL 15 MINUTE"
    );
    $stmt->execute([$ip]);
    if ($stmt->fetchColumn() >= 5) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'error' => 'Demasiados intentos. Espera 15 minutos.']);
        exit;
    }
}

function recordLoginAttempt(string $ip): void {
    $db = getDB();
    $db->prepare('INSERT INTO login_attempts (ip_address) VALUES (?)')->execute([$ip]);
}
