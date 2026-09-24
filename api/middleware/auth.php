<?php
function isAdmin(): bool {
    return session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['admin_id']);
}

function requireAuth(): void {
    if (!isAdmin()) respond(false, 'No autorizado', 401);
}

function csrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $known = $_SESSION['csrf_token'] ?? '';
    if ($known === '' || !is_string($token) || !hash_equals($known, $token)) {
        respond(false, 'Token CSRF inválido', 403);
    }
}

function checkLoginRateLimit(string $ip): void {
    $db = getDB();
    // Limpieza oportunista de intentos antiguos
    $db->exec("DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL 1 DAY");
    $stmt = $db->prepare(
        "SELECT COUNT(*) FROM login_attempts
         WHERE ip_address = ? AND attempted_at > NOW() - INTERVAL 15 MINUTE"
    );
    $stmt->execute([$ip]);
    if ($stmt->fetchColumn() >= 5) {
        respond(false, 'Demasiados intentos. Espera 15 minutos.', 429);
    }
}

function recordLoginAttempt(string $ip): void {
    getDB()->prepare('INSERT INTO login_attempts (ip_address) VALUES (?)')->execute([$ip]);
}

/**
 * Límite simple por IP para formularios públicos (comentarios, contacto).
 * $table debe tener columnas ip_address y created_at.
 */
function checkPublicRateLimit(string $table, int $max, int $minutes): void {
    $allowed = ['comments', 'messages'];
    if (!in_array($table, $allowed, true)) return;
    $stmt = getDB()->prepare(
        "SELECT COUNT(*) FROM {$table} WHERE ip_address = ? AND created_at > NOW() - INTERVAL {$minutes} MINUTE"
    );
    $stmt->execute([clientIp()]);
    if ($stmt->fetchColumn() >= $max) {
        respond(false, 'Has enviado demasiados mensajes. Inténtalo más tarde.', 429);
    }
}

/** Valida los campos anti-bot (_hp honeypot y _ts tiempo mínimo). */
function checkAntiBot(array $body): void {
    if (!empty($body['_hp'])) respond(false, 'Envío no válido', 400);
    $ts = (int)($body['_ts'] ?? 0);
    $elapsed = time() - $ts;
    if ($ts <= 0 || $elapsed < 3) respond(false, 'Envío demasiado rápido', 400);
    if ($elapsed > 86400) respond(false, 'El formulario caducó, recarga la página', 400);
}
