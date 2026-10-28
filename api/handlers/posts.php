<?php
$method = $GLOBALS['_METHOD'];
$id     = $GLOBALS['_ID'];
$sub    = $GLOBALS['_SUB'];
$body   = $GLOBALS['_BODY'];
$db     = getDB();

require_once __DIR__ . '/../lib/posts-data.php';

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

    $posts = listPosts($db, $where, $params);
    $cats  = allCategories($db);

    respond(true, ['posts' => $posts, 'categories' => $cats]);
}

requireAuth();
if (in_array($method, ['POST','PATCH','DELETE'])) verifyCsrf();

// Portada: solo imágenes subidas a Multimedia (misma forma que devuelve /api/media); "" la quita
function coverImage(PDO $db, mixed $value): ?string {
    $v = trim((string)($value ?? ''));
    if ($v !== '' && !hasColumn($db, 'posts', 'cover_image')) {
        respond(false, 'Falta la columna de portada: ejecuta migrations/2026-09-28-cover-image.sql en phpMyAdmin', 409);
    }
    if ($v === '') return null;
    if (!preg_match('#^uploads/media/[a-f0-9]{16,64}\.(jpg|png|gif|webp)$#', $v)) {
        respond(false, 'La portada debe ser una imagen de Multimedia', 400);
    }
    return $v;
}

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

    $exists = $db->prepare('SELECT 1 FROM posts WHERE id = ?');
    $exists->execute([$postId]);
    if ($exists->fetchColumn()) respond(false, "Ya existe un post con el slug «{$postId}»", 409);

    $cover = coverImage($db, $body['cover_image'] ?? null);
    $cols  = ['id', 'title', 'body', 'excerpt', 'category_id', 'status', 'date'];
    $vals  = [$postId, $title, $postBody, $excerpt, $categoryId, $status, $date];
    if (hasColumn($db, 'posts', 'cover_image')) { $cols[] = 'cover_image'; $vals[] = $cover; }
    $db->prepare('INSERT INTO posts (' . implode(', ', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')')
       ->execute($vals);

    syncTags($db, $postId, $tags);
    respond(true, ['id' => $postId], 201);
}

// PATCH /api/posts/:id
if ($method === 'PATCH' && $id) {
    $allowed = ['title','body','excerpt','category_id','status','date','scheduled_at'];
    if (isset($body['status']) && !in_array($body['status'], ['published','draft','scheduled'], true)) {
        respond(false, 'Estado inválido', 400);
    }
    // Un cuerpo vacío sobre un post con contenido casi siempre es un error del cliente
    // (p. ej. editar con datos incompletos): exige confirmarlo con force_empty_body.
    if (array_key_exists('body', $body) && trim((string)$body['body']) === '' && empty($body['force_empty_body'])) {
        $cur = $db->prepare('SELECT body FROM posts WHERE id = ?');
        $cur->execute([$id]);
        if (trim((string)$cur->fetchColumn()) !== '') {
            respond(false, 'El contenido está vacío y el post guardado no lo está; no se ha sobrescrito', 409);
        }
    }
    if (array_key_exists('cover_image', $body)) {
        $body['cover_image'] = coverImage($db, $body['cover_image']);
        if (hasColumn($db, 'posts', 'cover_image')) $allowed[] = 'cover_image';
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
