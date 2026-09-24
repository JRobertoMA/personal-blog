<?php
requireAuth();

$db   = getDB();
$days = max(7, min(365, (int)($_GET['days'] ?? 30)));

$stmt = $db->prepare(
    "SELECT viewed_date AS date, SUM(views) AS views
     FROM pageviews
     WHERE viewed_date >= CURDATE() - INTERVAL ? DAY
     GROUP BY viewed_date ORDER BY viewed_date ASC"
);
$stmt->execute([$days]);
$daily = $stmt->fetchAll();

$filled = [];
for ($i = $days; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-$i days"));
    $filled[$d] = 0;
}
foreach ($daily as $row) $filled[$row['date']] = (int)$row['views'];

$totals = $db->query(
    "SELECT SUM(views) AS total_views,
            (SELECT COUNT(*) FROM posts WHERE status = 'published') AS posts,
            (SELECT COUNT(*) FROM comments WHERE status = 'approved') AS comments,
            (SELECT COUNT(*) FROM messages) AS messages
     FROM pageviews WHERE viewed_date >= CURDATE() - INTERVAL {$days} DAY"
)->fetch();

$topPosts = $db->prepare(
    "SELECT p.id, p.title, p.views, p.date
     FROM posts p WHERE p.status = 'published'
     ORDER BY p.views DESC LIMIT 10"
);
$topPosts->execute();

respond(true, [
    'days'      => $days,
    'daily'     => array_map(fn($d, $v) => ['date' => $d, 'views' => $v], array_keys($filled), array_values($filled)),
    'totals'    => $totals,
    'top_posts' => $topPosts->fetchAll(),
]);
