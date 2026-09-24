<?php
$method = $GLOBALS['_METHOD'];
$id     = $GLOBALS['_ID'];
$sub    = $GLOBALS['_SUB'];
$body   = $GLOBALS['_BODY'];
$db     = getDB();

function postTags(PDO $db, array $ids): array {
    if (!$ids) return [];
    $in   = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $db->prepare(
        "SELECT pt.post_id, t.name
         FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
         WHERE pt.post_id IN ($in)"
    );
    $stmt->execute($ids);
    $map = [];
    foreach ($stmt->fetchAll() as $row) {
        $map[$row['post_id']][] = $row['name'];
    }
    return $map;
}

function syncTags(PDO $db, string $postId, array $tagNames): void {
    $db->prepare('DELETE FROM post_tags WHERE post_id = ?')->execute([$postId]);
    foreach (array_unique($tagNames) as $name) {
        $name = trim($name);
        if (!$name) continue;
        $db->prepare('INSERT IGNORE INTO tags (name) VALUES (?)')->execute([$name]);
        $stmt = $db->prepare('SELECT id FROM tags WHERE name = ?');
        $stmt->execute([$name]);
        $tagId = $stmt->fetchColumn();
        $db->prepare('INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES (?,?)')->execute([$postId, $tagId]);
    }
}

// POST /api/posts/:id/view
if ($method === 'POST' && $id && $sub === 'view') {
    // Solo cuenta posts publicados que existen (evita inflar la tabla con ids falsos)
    $stmt = $db->prepare("SELECT 1 FROM posts WHERE id = ? AND status = 'published'");
    $stmt->execute([$id]);
    if (!$stmt->fetchColumn()) respond(false, 'Post no encontrado', 404);
    $today = date('Y-m-d');
    $db->prepare(
        'INSERT INTO pageviews (post_id, viewed_date, views) VALUES (?,?,1)
         ON DUPLICATE KEY UPDATE views = views + 1'
    )->execute([$id, $today]);
    $db->prepare('UPDATE posts SET views = views + 1 WHERE id = ?')->execute([$id]);
    respond(true, null);
}

// GET /api/posts/:id
if ($method === 'GET' && $id) {
    $adminMode = isAdmin();
    $stmt = $db->prepare(
        'SELECT p.*, c.label AS category_label, c.color AS category_color
         FROM posts p JOIN categories c ON c.id = p.category_id
         WHERE p.id = ?' . (!$adminMode ? " AND p.status = 'published'" : '')
    );
    $stmt->execute([$id]);
    $post = $stmt->fetch();
    if (!$post) respond(false, 'Post no encontrado', 404);
    $tagMap = postTags($db, [$id]);
    $post['tags'] = $tagMap[$id] ?? [];
    respond(true, $post);
}

// GET /api/posts
if ($method === 'GET') {
    $adminMode = isAdmin();
    $where  = [];
    $params = [];

    if (!$adminMode) {
        $where[] = "p.status = 'published'";
    } else {
        $status = $_GET['status'] ?? null;
        if ($status && in_array($status, ['published','draft','scheduled'])) {
            $where[] = 'p.status = ?';
            $params[] = $status;
        }
    }

    $cat = $_GET['category'] ?? null;
    if ($cat) { $where[] = 'p.category_id = ?'; $params[] = $cat; }

    $q = $_GET['q'] ?? null;
    if (is_string($q) && $q !== '') {
        $like = '%' . addcslashes(mb_substr($q, 0, 100), '%_\\') . '%';
        $where[] = '(p.title LIKE ? OR p.excerpt LIKE ?)'; $params[] = $like; $params[] = $like;
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $db->prepare(
        "SELECT p.id, p.title, p.excerpt, p.category_id, p.status, p.date, p.views,
                c.label AS category_label, c.color AS category_color,
                (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'approved') AS comment_count
         FROM posts p JOIN categories c ON c.id = p.category_id
         $whereSql
         ORDER BY p.date DESC"
    );
    $stmt->execute($params);
    $posts = $stmt->fetchAll();

    $ids    = array_column($posts, 'id');
    $tagMap = postTags($db, $ids);
    foreach ($posts as &$p) $p['tags'] = $tagMap[$p['id']] ?? [];

    $cats = $db->query('SELECT * FROM categories ORDER BY sort_order')->fetchAll();

    respond(true, ['posts' => $posts, 'categories' => $cats]);
}

requireAuth();
if (in_array($method, ['POST','PATCH','DELETE'])) verifyCsrf();

// POST /api/posts
if ($method === 'POST') {
    $title      = trim($body['title'] ?? '');
    $postBody   = trim($body['body'] ?? '');
    $excerpt    = trim($body['excerpt'] ?? '');
    $categoryId = trim($body['category_id'] ?? '');
    $status     = $body['status'] ?? 'draft';
    $date       = $body['date'] ?? date('Y-m-d');
    $tags       = (array)($body['tags'] ?? []);
    $postId     = trim((string)($body['id'] ?? '')) ?: ('p' . uniqid());

    if (!$title || !$categoryId) respond(false, 'Título y categoría requeridos', 400);
    if (!is_string($postId) || !preg_match('/^[a-z0-9-]{1,60}$/', $postId)) {
        respond(false, 'El slug solo puede contener a-z, 0-9 y guiones (máx. 60)', 400);
    }
    if (!in_array($status, ['published','draft','scheduled'])) respond(false, 'Estado inválido', 400);

    $db->prepare(
        'INSERT INTO posts (id, title, body, excerpt, category_id, status, date) VALUES (?,?,?,?,?,?,?)'
    )->execute([$postId, $title, $postBody, $excerpt, $categoryId, $status, $date]);

    syncTags($db, $postId, $tags);
    respond(true, ['id' => $postId], 201);
}

// PATCH /api/posts/:id
if ($method === 'PATCH' && $id) {
    $allowed = ['title','body','excerpt','category_id','status','date','scheduled_at'];
    if (isset($body['status']) && !in_array($body['status'], ['published','draft','scheduled'], true)) {
        respond(false, 'Estado inválido', 400);
    }
    $sets = []; $params = [];
    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $sets[]   = "$field = ?";
            $params[] = $body[$field];
        }
    }
    if ($sets) {
        $params[] = $id;
        $db->prepare('UPDATE posts SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
    }
    if (isset($body['tags'])) syncTags($db, $id, (array)$body['tags']);
    respond(true, ['id' => $id]);
}

// DELETE /api/posts/:id
if ($method === 'DELETE' && $id) {
    $db->prepare('DELETE FROM posts WHERE id = ?')->execute([$id]);
    respond(true, null);
}

respond(false, 'Método no permitido', 405);
