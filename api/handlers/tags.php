<?php
$method = $GLOBALS['_METHOD'];
$id     = $GLOBALS['_ID']; // tag name (URL-encoded)
$body   = $GLOBALS['_BODY'];
$db     = getDB();

// GET /api/tags
if ($method === 'GET') {
    $rows = $db->query(
        "SELECT t.name, COUNT(pt.post_id) AS post_count
         FROM tags t
         LEFT JOIN post_tags pt ON pt.tag_id = t.id
         GROUP BY t.id, t.name
         ORDER BY post_count DESC, t.name ASC"
    )->fetchAll();
    respond(true, $rows);
}

requireAuth();
if (in_array($method, ['POST','DELETE'])) verifyCsrf();

// POST /api/tags
if ($method === 'POST') {
    $name = trim($body['name'] ?? '');
    if (!$name) respond(false, 'name requerido', 400);
    $db->prepare('INSERT IGNORE INTO tags (name) VALUES (?)')->execute([$name]);
    respond(true, ['name' => $name], 201);
}

// DELETE /api/tags/:name
if ($method === 'DELETE' && $id) {
    $name = urldecode($id);
    $stmt = $db->prepare('SELECT id FROM tags WHERE name = ?');
    $stmt->execute([$name]);
    $tag = $stmt->fetch();
    if (!$tag) respond(false, 'Tag no encontrado', 404);
    $db->prepare('DELETE FROM tags WHERE id = ?')->execute([$tag['id']]);
    respond(true, null);
}

respond(false, 'Método no permitido', 405);
