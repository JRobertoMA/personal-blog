<?php
$method = $GLOBALS['_METHOD'];
$id     = $GLOBALS['_ID'];
$body   = $GLOBALS['_BODY'];
$db     = getDB();

// POST /api/messages — public
if ($method === 'POST' && !$id) {
    $name    = trim($body['sender_name'] ?? '');
    $email   = trim($body['sender_email'] ?? '');
    $subject = trim($body['subject'] ?? '');
    $text    = trim($body['body'] ?? '');

    checkAntiBot($body);
    if (!$name || !$email || !$text) respond(false, 'Nombre, email y mensaje son requeridos', 400);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respond(false, 'Email inválido', 400);
    if (mb_strlen($text) > 5000 || mb_strlen($name) > 120 || mb_strlen($email) > 200 || mb_strlen($subject) > 300) {
        respond(false, 'Mensaje demasiado largo', 400);
    }

    checkPublicRateLimit('messages', 3, 30);

    $ip = clientIp();
    $db->prepare(
        'INSERT INTO messages (sender_name, sender_email, subject, body, ip_address) VALUES (?,?,?,?,?)'
    )->execute([$name, $email, $subject ?: null, $text, $ip]);

    respond(true, ['message' => 'Mensaje enviado correctamente'], 201);
}

requireAuth();

// GET /api/messages
if ($method === 'GET' && !$id) {
    $archived = (int)($_GET['archived'] ?? 0);
    $stmt = $db->prepare(
        'SELECT * FROM messages WHERE is_archived = ? ORDER BY created_at DESC'
    );
    $stmt->execute([$archived]);
    respond(true, $stmt->fetchAll());
}

if (in_array($method, ['PATCH','DELETE'])) verifyCsrf();

// PATCH /api/messages/:id
if ($method === 'PATCH' && $id) {
    $allowed = ['is_read','is_archived'];
    $sets = []; $params = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) { $sets[] = "$f = ?"; $params[] = (int)$body[$f]; }
    }
    if ($sets) { $params[] = $id; $db->prepare('UPDATE messages SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params); }
    respond(true, ['id' => $id]);
}

// DELETE /api/messages/:id
if ($method === 'DELETE' && $id) {
    $db->prepare('DELETE FROM messages WHERE id = ?')->execute([$id]);
    respond(true, null);
}

respond(false, 'Método no permitido', 405);
