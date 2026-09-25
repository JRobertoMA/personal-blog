<?php
requireAuth();

$method = $GLOBALS['_METHOD'];
$id     = $GLOBALS['_ID'];
$body   = $GLOBALS['_BODY'];
$db     = getDB();

if ($method === 'GET') {
    $rows = $db->query('SELECT key_name, value FROM settings')->fetchAll(PDO::FETCH_KEY_PAIR);
    respond(true, $rows);
}

if ($method === 'PATCH') {
    verifyCsrf();
    $allowed = [
        'profile'  => ['profile_name','profile_email','profile_bio'],
        'site'     => ['site_domain','site_title','site_description','site_posts_per_page'],
        'social'   => ['social_github','social_mastodon','social_rss','social_email'],
        'comments' => ['comments_enabled','rss_enabled'],
        'advanced' => ['analytics_enabled','webhook_url'],
    ];
    $group = $id ?? 'profile';
    $keys  = $allowed[$group] ?? [];

    $stmt = $db->prepare('INSERT INTO settings (key_name, value) VALUES (?,?) ON DUPLICATE KEY UPDATE value = ?');
    foreach ($keys as $key) {
        if (array_key_exists($key, $body)) {
            $val = is_bool($body[$key]) ? (int)$body[$key] : (string)$body[$key];
            if (!fitsSettingsValue((string)$val)) respond(false, "El valor de «{$key}» es demasiado largo", 400);
            $stmt->execute([$key, $val, $val]);
        }
    }
    respond(true, ['group' => $group]);
}

respond(false, 'Método no permitido', 405);
