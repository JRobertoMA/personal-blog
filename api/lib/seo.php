<?php
declare(strict_types=1);

// ─── SEO: datos, Markdown y HTML para buscadores ─────────────────
// Lo usa page.php. Todo el texto que sale de la base de datos pasa por h()
// o por Parsedown en modo seguro (escapa el HTML y neutraliza javascript:).

require_once __DIR__ . '/Parsedown.php';
require_once __DIR__ . '/about-data.php';

function h(mixed $s): string {
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

// ── Ajustes del sitio ─────────────────────────────────────────
function siteSettings(PDO $db): array {
    $rows = $db->query(
        "SELECT key_name, value FROM settings
         WHERE key_name IN ('site_title', 'site_description', 'site_domain', 'rss_enabled')"
    )->fetchAll(PDO::FETCH_KEY_PAIR);

    $domain = preg_replace('#^https?://|/.*$#i', '', trim((string)($rows['site_domain'] ?? '')));
    if ($domain === '' || !preg_match('/^[a-z0-9.-]+(:\d+)?$/i', $domain)) {
        $domain = preg_replace('/[^a-z0-9.:-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
    }
    return [
        'title'       => trim((string)($rows['site_title'] ?? '')) ?: 'jrobertoma.com',
        'description' => trim((string)($rows['site_description'] ?? '')),
        // El canonical siempre apunta al dominio público, aunque se pruebe en local
        'origin'      => 'https://' . $domain,
        'rss'         => ($rows['rss_enabled'] ?? '1') !== '0',
    ];
}

function absUrl(string $origin, string $path): string {
    if (preg_match('#^https?://#i', $path)) return $path;
    return $origin . '/' . ltrim($path, '/');
}

// ── Consultas ─────────────────────────────────────────────────
const POST_COLUMNS = "p.id, p.title, p.excerpt, p.category_id, p.date, p.updated_at,
                      c.label AS category_label, c.description AS category_description";

function publishedPosts(PDO $db, string $where = '', array $params = [], int $limit = 0): array {
    $sql = 'SELECT ' . POST_COLUMNS . " FROM posts p JOIN categories c ON c.id = p.category_id
            WHERE p.status = 'published'" . ($where ? " AND $where" : '') . '
            ORDER BY p.date DESC, p.id' . ($limit ? ' LIMIT ' . $limit : '');
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function publishedPost(PDO $db, string $id): ?array {
    $cover = hasColumn($db, 'posts', 'cover_image') ? ', p.cover_image' : '';
    $stmt = $db->prepare('SELECT ' . POST_COLUMNS . ", p.body$cover FROM posts p JOIN categories c ON c.id = p.category_id
                          WHERE p.id = ? AND p.status = 'published'");
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

function tagsFor(PDO $db, array $postIds): array {
    if (!$postIds) return [];
    $in = implode(',', array_fill(0, count($postIds), '?'));
    $stmt = $db->prepare("SELECT pt.post_id, t.name FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
                          WHERE pt.post_id IN ($in) ORDER BY t.name");
    $stmt->execute(array_values($postIds));
    $map = [];
    foreach ($stmt->fetchAll() as $r) $map[$r['post_id']][] = $r['name'];
    return $map;
}

function categoryById(PDO $db, string $id): ?array {
    $stmt = $db->prepare('SELECT id, label, description FROM categories WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

// ── Markdown → HTML (Parsedown, modo seguro) ──────────────────
// Igual que en la web: los saltos simples son <br> y "#" baja a h2 (el h1 es el título).
// Con $origin, las rutas relativas pasan a absolutas (para el feed RSS).
function markdownHtml(string $md, ?string $origin = null): string {
    static $pd = null;
    if ($pd === null) {
        $pd = new Parsedown();
        $pd->setSafeMode(true);
        $pd->setBreaksEnabled(true);
    }
    $html = $pd->text($md);
    $html = preg_replace('#<(/?)h1>#', '<$1h2>', $html) ?? $html;
    if ($origin !== null) {
        $html = preg_replace_callback(
            '#\b(src|href)="(?!https?:|mailto:|\#)([^"]*)"#i',
            fn($m) => $m[1] . '="' . h(absUrl($origin, html_entity_decode($m[2], ENT_QUOTES, 'UTF-8'))) . '"',
            $html
        ) ?? $html;
    }
    return $html;
}

// Texto plano para descripciones: primer tramo del post sin formato
function plainText(string $md, int $max = 160): string {
    $text = trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags(markdownHtml($md)), ENT_QUOTES, 'UTF-8')) ?? '');
    if (mb_strlen($text) <= $max) return $text;
    $cut = mb_substr($text, 0, $max);
    $sp  = mb_strrpos($cut, ' ');
    return rtrim(mb_substr($cut, 0, $sp !== false && $sp > $max * 0.6 ? $sp : $max), " ,.;:") . '…';
}

function postDescription(array $post): string {
    $ex = trim((string)($post['excerpt'] ?? ''));
    return $ex !== '' ? plainText($ex, 200) : plainText((string)($post['body'] ?? ''));
}

// Primera imagen del post: ruta de Multimedia o URL https
function firstImage(string $md): ?string {
    if (!preg_match_all('/!\[[^\]]*\]\(\s*<?([^)\s>]+)/', $md, $m)) return null;
    foreach ($m[1] as $src) {
        if (preg_match('#^(https://|/?uploads/media/)#i', $src)) return $src;
    }
    return null;
}

// ── Imagen para compartir (og:image) ──────────────────────────
// Devuelve ['url', 'width', 'height', 'alt'] con URL absoluta; las dimensiones
// salen de la tabla media cuando la imagen es de Multimedia.
const OG_DEFAULT = ['path' => 'assets/og-default.png', 'width' => 1200, 'height' => 630];

function imageMeta(PDO $db, string $origin, ?string $src, string $alt = ''): ?array {
    if (!$src) return null;
    $img = ['url' => absUrl($origin, $src), 'width' => null, 'height' => null, 'alt' => $alt];
    if (preg_match('~^/?uploads/media/([^/?#]+)$~', $src, $m)) {
        $stmt = $db->prepare('SELECT width, height FROM media WHERE filename = ?');
        $stmt->execute([rawurldecode($m[1])]);
        if ($row = $stmt->fetch()) { $img['width'] = $row['width']; $img['height'] = $row['height']; }
    }
    return $img;
}

function defaultImage(array $site): array {
    return ['url' => $site['origin'] . '/' . OG_DEFAULT['path'], 'width' => OG_DEFAULT['width'],
            'height' => OG_DEFAULT['height'], 'alt' => $site['title']];
}

// Portada elegida → primera imagen del post → imagen genérica del blog
function postImage(PDO $db, array $site, array $post): array {
    return imageMeta($db, $site['origin'], $post['cover_image'] ?? null, $post['title'])
        ?? imageMeta($db, $site['origin'], firstImage($post['body']), $post['title'])
        ?? defaultImage($site);
}

// Fecha legible en español: 28 abr 2026
function fmtDate(string $iso): string {
    static $months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    [$y, $m, $d] = array_map('intval', explode('-', substr($iso, 0, 10)) + [0, 1, 1]);
    return $d . ' ' . ($months[$m - 1] ?? '') . ' ' . $y;
}

// Fecha de última modificación (Y-m-d): la mayor entre publicación y edición
function modifiedDate(array $post): string {
    $pub = substr((string)$post['date'], 0, 10);
    $upd = substr((string)($post['updated_at'] ?? ''), 0, 10);
    return $upd > $pub ? $upd : $pub;
}

function jsonLd(array $data): string {
    return '<script type="application/ld+json">'
        . json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP)
        . '</script>';
}

// ── <head> ────────────────────────────────────────────────────
// $m: title, description, canonical, type, image, robots, article[], jsonld[]
function renderHead(array $m, array $site, string $base): string {
    $out = [];
    $out[] = '<base href="' . h($base . '/') . '" />';
    $out[] = '<title>' . h($m['title']) . '</title>';
    if (!empty($m['description'])) $out[] = '<meta name="description" content="' . h($m['description']) . '" />';
    if (!empty($m['robots']))      $out[] = '<meta name="robots" content="' . h($m['robots']) . '" />';
    if (!empty($m['canonical']))   $out[] = '<link rel="canonical" href="' . h($m['canonical']) . '" />';
    if ($site['rss']) {
        $out[] = '<link rel="alternate" type="application/rss+xml" title="' . h($site['title']) . '" href="' . h($site['origin'] . '/feed.xml') . '" />';
    }
    $og = [
        'og:site_name'   => $site['title'],
        'og:locale'      => 'es_ES',
        'og:type'        => $m['type'] ?? 'website',
        'og:title'       => $m['og_title'] ?? $m['title'],
        'og:description' => $m['description'] ?? '',
        'og:url'         => $m['canonical'] ?? '',
    ];
    $img = $m['image'] ?? null;
    if ($img) {
        $og['og:image'] = $img['url'];
        if (str_starts_with($img['url'], 'https://')) $og['og:image:secure_url'] = $img['url'];
        $og['og:image:width']  = (string)($img['width'] ?? '');
        $og['og:image:height'] = (string)($img['height'] ?? '');
        $og['og:image:alt']    = (string)($img['alt'] ?? '');
    }
    foreach ($og as $k => $v) if ($v !== '') $out[] = '<meta property="' . $k . '" content="' . h($v) . '" />';
    foreach ($m['article'] ?? [] as [$k, $v]) $out[] = '<meta property="' . h($k) . '" content="' . h($v) . '" />';
    $out[] = '<meta name="twitter:card" content="' . (!empty($m['image']) ? 'summary_large_image' : 'summary') . '" />';
    foreach ($m['jsonld'] ?? [] as $data) $out[] = jsonLd($data);
    return implode("\n", $out);
}

// ── HTML de cada página (dentro de #root; React lo sustituye) ──
function postListHtml(array $posts): string {
    if (!$posts) return '<p>Todavía no hay posts publicados.</p>';
    $items = array_map(fn($p) =>
        '<li><article><h2><a href="post/' . h(rawurlencode($p['id'])) . '">' . h($p['title']) . '</a></h2>'
        . '<p class="ssr-meta"><time datetime="' . h($p['date']) . '">' . h(fmtDate($p['date'])) . '</time> · '
        . '<a href="categoria/' . h(rawurlencode($p['category_id'])) . '">' . h($p['category_label']) . '</a></p>'
        . ($p['excerpt'] ? '<p>' . h($p['excerpt']) . '</p>' : '')
        . '</article></li>', $posts);
    return '<ul class="ssr-list">' . implode('', $items) . '</ul>';
}

function tagLinks(array $tags): string {
    if (!$tags) return '';
    return '<p class="ssr-tags">' . implode(' ', array_map(fn($t) =>
        '<a href="tag/' . h(rawurlencode($t)) . '">#' . h($t) . '</a>', $tags)) . '</p>';
}

function pageShell(string $inner, array $site, array $categories = []): string {
    $nav = '<a href="./">' . h($site['title']) . '</a>';
    foreach ($categories as $c) $nav .= ' · <a href="categoria/' . h(rawurlencode($c['id'])) . '">' . h($c['label']) . '</a>';
    $nav .= ' · <a href="sobre-mi">Sobre mí</a>';
    $foot = '<a href="sobre-mi">Sobre mí</a> · <a href="contacto">Contacto</a>' . ($site['rss'] ? ' · <a href="feed.xml">RSS</a>' : '');
    return '<div class="ssr"><nav class="ssr-nav" aria-label="Secciones">' . $nav . '</nav>'
        . '<main>' . $inner . '</main><footer class="ssr-foot">' . $foot . '</footer></div>';
}
