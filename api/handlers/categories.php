<?php
$method = $GLOBALS['_METHOD'];
$id     = $GLOBALS['_ID'];
$body   = $GLOBALS['_BODY'];
$db     = getDB();

// GET /api/categories
if ($method === 'GET') {
    $rows = $db->query(
        "SELECT c.*, COUNT(p.id) AS post_count
         FROM categories c
         LEFT JOIN posts p ON p.category_id = c.id AND p.status = 'published'
         GROUP BY c.id
         ORDER BY c.sort_order"
    )->fetchAll();
    respond(true, $rows);
}

requireAuth();
if (in_array($method, ['POST','PATCH','DELETE'])) verifyCsrf();

// POST /api/categories
if ($method === 'POST') {
    $catId = trim($body['id'] ?? '');
    $label = trim($body['label'] ?? '');
    $color = trim($body['color'] ?? '#39ff14');
    $desc  = trim($body['description'] ?? '');
    $order = (int)($body['sort_order'] ?? 0);

    if (!$catId || !$label) respond(false, 'id y label requeridos', 400);

    $db->prepare(
        'INSERT INTO categories (id, label, description, color, sort_order) VALUES (?,?,?,?,?)'
    )->execute([$catId, $label, $desc, $color, $order]);
    respond(true, ['id' => $catId], 201);
}

// PATCH /api/categories/:id
if ($method === 'PATCH' && $id) {
    $allowed = ['label','description','color','sort_order'];
    $sets = []; $params = [];
    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $sets[]   = "$field = ?";
            $params[] = $body[$field];
        }
    }
    if ($sets) {
        $params[] = $id;
        $db->prepare('UPDATE categories SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
    }
    respond(true, ['id' => $id]);
}

// DELETE /api/categories/:id
if ($method === 'DELETE' && $id) {
    $stmt = $db->prepare('SELECT COUNT(*) FROM posts WHERE category_id = ?');
    $stmt->execute([$id]);
    if ($stmt->fetchColumn() > 0) respond(false, 'No se puede eliminar: hay posts en esta categoría', 409);
    $db->prepare('DELETE FROM categories WHERE id = ?')->execute([$id]);
    respond(true, null);
}

respond(false, 'Método no permitido', 405);
