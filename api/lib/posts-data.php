<?php
declare(strict_types=1);

// Listado de posts tal como lo devuelve GET /api/posts. Compartido por la API
// (handlers/posts.php) y por page.php, que lo incrusta en la página para que
// la web no tenga que pedirlo al arrancar.

function postTags(PDO $db, array $ids): array {
    if (!$ids) return [];
    $in   = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $db->prepare(
        "SELECT pt.post_id, t.name
         FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
         WHERE pt.post_id IN ($in)"
    );
    $stmt->execute(array_values($ids));
    $map = [];
    foreach ($stmt->fetchAll() as $row) {
        $map[$row['post_id']][] = $row['name'];
    }
    return $map;
}

// $where: condiciones SQL ya preparadas (con ?) y sus parámetros
function listPosts(PDO $db, array $where = [], array $params = []): array {
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

    $tagMap = postTags($db, array_column($posts, 'id'));
    foreach ($posts as &$p) $p['tags'] = $tagMap[$p['id']] ?? [];
    unset($p);
    return $posts;
}

function allCategories(PDO $db): array {
    return $db->query('SELECT * FROM categories ORDER BY sort_order')->fetchAll();
}
