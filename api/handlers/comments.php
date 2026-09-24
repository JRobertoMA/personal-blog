<?php
$method = $GLOBALS['_METHOD'];
$id     = $GLOBALS['_ID'];
$body   = $GLOBALS['_BODY'];
$db     = getDB();

if ($method === 'GET') {
    $postId = $_GET['post_id'] ?? null;
    if ($postId && !isAdmin()) {
        $stmt = $db->prepare(
            "SELECT id, post_id, author_name, body, created_at
             FROM comments
             WHERE post_id = ? AND status = 'approved'
             ORDER BY created_at ASC"
        );
        $stmt->execute([$postId]);
        respond(true, $stmt->fetchAll());
    }
    requireAuth();
    $filter = $_GET['filter'] ?? 'all';
    $where  = []; $params = [];
    if ($filter === 'pending') { $where[] = "status = 'pending'"; }
    if ($filter === 'spam')    { $where[] = "status = 'spam'"; }
    if ($postId)               { $where[] = 'post_id = ?'; $params[] = $postId; }
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $stmt = $db->prepare("SELECT * FROM comments $whereSql ORDER BY created_at DESC");
    $stmt->execute($params);
    respond(true, $stmt->fetchAll());
}

if ($method === 'POST' && !$id) {
    $postId = trim($body['post_id'] ?? '');
    $name   = trim($body['author_name'] ?? '');
    $email  = trim($body['author_email'] ?? '');
    $text   = trim($body['body'] ?? '');
    $hp     = $body['_hp'] ?? null;
    $ts     = (int)($body['_ts'] ?? 0);

    if ($hp) respond(false, 'Invalid submission', 400);
    if (time() - $ts < 3) respond(false, 'Envío demasiado rápido', 400);
    if (!$postId || !$name || !$text) respond(false, 'post_id, author_name y body son requeridos', 400);
    if (strlen($name) > 120 || strlen($text) > 5000) respond(false, 'Contenido demasiado largo', 400);
    if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) respond(false, 'Email inválido', 400);

    $stmt = $db->prepare("SELECT id FROM posts WHERE id = ? AND status = 'published'");
    $stmt->execute([$postId]);
    if (!$stmt->fetch()) respond(false, 'Post no encontrado', 404);

    $ip = $_SERVER['REMOTE_ADDR'] ?? null;
    $db->prepare(
        'INSERT INTO comments (post_id, author_name, author_email, body, status, ip_address) VALUES (?,?,?,?,?,?)'
    )->execute([$postId, $name, $email ?: null, $text, 'pending', $ip]);

    respond(true, ['message' => 'Comentario recibido y pendiente de moderación'], 201);
}

requireAuth();
if (in_array($method, ['PATCH','DELETE'])) verifyCsrf();

if ($method === 'PATCH' && $id) {
    $allowed = ['status','body'];
    $sets = []; $params = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) { $sets[] = "$f = ?"; $params[] = $body[$f]; }
    }
    if ($sets) { $params[] = $id; $db->prepare('UPDATE comments SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params); }
    respond(true, ['id' => $id]);
}

if ($method === 'DELETE' && $id) {
    $db->prepare('DELETE FROM comments WHERE id = ?')->execute([$id]);
    respond(true, null);
}

respond(false, 'Método no permitido', 405);
