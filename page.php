<?php
declare(strict_types=1);

// ─── Páginas públicas con HTML para buscadores ───────────────────
// .htaccess manda aquí la portada y todas las rutas sin extensión
// (/post/<slug>, /categoria/<id>, /tag/<tag>, /sobre-mi…), además de
// robots.txt, sitemap.xml y feed.xml. Devuelve index.html con el <head> de
// cada página y su contenido en HTML dentro de #root; React lo reemplaza al
// arrancar. Ver docs/PLAN-SEO.md.

ini_set('display_errors', '0');
ini_set('log_errors', '1');

require __DIR__ . '/api/config/database.php';
require __DIR__ . '/api/lib/seo.php';

// Carpeta base ("" en el dominio, "/personal-blog" en una copia local)
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/page.php')), '/');
$path = rawurldecode((string)strtok($_SERVER['REQUEST_URI'] ?? '/', '?'));
if ($base !== '' && str_starts_with($path, $base . '/')) $path = substr($path, strlen($base));
$path  = trim($path, '/');
$parts = explode('/', $path, 2);
$section = $parts[0];
$param   = $parts[1] ?? '';

try {
    $db   = getDB();
    $site = siteSettings($db);
} catch (Throwable $e) {
    apiLog('page.php: ' . $e->getMessage());
    // Sin base de datos: la app se entrega igual (mostrará su propio error)
    http_response_code(503);
    header('Retry-After: 300');
    header('Content-Type: text/html; charset=utf-8');
    echo render(
        ['title' => 'jrobertoma.com', 'robots' => 'noindex'],
        '',
        ['title' => 'jrobertoma.com', 'origin' => '', 'rss' => false],
        $base
    );
    exit;
}

// ── Archivos para buscadores ──────────────────────────────────
if ($path === 'robots.txt') {
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: public, max-age=86400');
    echo "User-agent: *\nDisallow: /admin.html\n\nSitemap: {$site['origin']}/sitemap.xml\n";
    exit;
}

if ($path === 'sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    $posts = publishedPosts($db);
    $urls  = [['', $posts ? modifiedDate($posts[0]) : null], ['sobre-mi', null]];
    $cats  = [];
    foreach ($posts as $p) {
        $cats[$p['category_id']] = max($cats[$p['category_id']] ?? '', modifiedDate($p));
    }
    foreach ($cats as $id => $last) $urls[] = ['categoria/' . rawurlencode((string)$id), $last];
    foreach ($posts as $p) $urls[] = ['post/' . rawurlencode($p['id']), modifiedDate($p)];

    echo '<?xml version="1.0" encoding="UTF-8"?>', "\n", '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', "\n";
    foreach ($urls as [$u, $last]) {
        echo '  <url><loc>', h($site['origin'] . '/' . $u), '</loc>', $last ? '<lastmod>' . h($last) . '</lastmod>' : '', "</url>\n";
    }
    echo "</urlset>\n";
    exit;
}

if ($path === 'feed.xml') {
    if (!$site['rss']) { http_response_code(404); header('Content-Type: text/plain; charset=utf-8'); echo "RSS desactivado\n"; exit; }
    header('Content-Type: application/rss+xml; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    $posts = publishedPosts($db, '', [], 20);
    $bodies = [];
    if ($posts) {
        $in   = implode(',', array_fill(0, count($posts), '?'));
        $stmt = $db->prepare("SELECT id, body FROM posts WHERE id IN ($in)");
        $stmt->execute(array_column($posts, 'id'));
        $bodies = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    }
    $tags  = tagsFor($db, array_column($posts, 'id'));
    $rfc   = fn(string $d) => gmdate(DATE_RSS, strtotime(substr($d, 0, 10) . ' 00:00:00 UTC'));
    $build = $posts ? $rfc(modifiedDate($posts[0])) : gmdate(DATE_RSS);

    echo '<?xml version="1.0" encoding="UTF-8"?>', "\n";
    echo '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">', "\n<channel>\n";
    echo '  <title>', h($site['title']), "</title>\n";
    echo '  <link>', h($site['origin'] . '/'), "</link>\n";
    echo '  <description>', h($site['description'] ?: $site['title']), "</description>\n";
    echo "  <language>es</language>\n";
    echo '  <lastBuildDate>', $build, "</lastBuildDate>\n";
    echo '  <atom:link href="', h($site['origin'] . '/feed.xml'), '" rel="self" type="application/rss+xml" />', "\n";
    foreach ($posts as $p) {
        $url  = $site['origin'] . '/post/' . rawurlencode($p['id']);
        $body = (string)($bodies[$p['id']] ?? '');
        echo "  <item>\n";
        echo '    <title>', h($p['title']), "</title>\n";
        echo '    <link>', h($url), "</link>\n";
        echo '    <guid isPermaLink="true">', h($url), "</guid>\n";
        echo '    <pubDate>', $rfc($p['date']), "</pubDate>\n";
        echo '    <category>', h($p['category_label']), "</category>\n";
        foreach ($tags[$p['id']] ?? [] as $t) echo '    <category>', h($t), "</category>\n";
        echo '    <description>', h(postDescription($p + ['body' => $body])), "</description>\n";
        echo '    <content:encoded>', h(markdownHtml($body, $site['origin'])), "</content:encoded>\n";
        echo "  </item>\n";
    }
    echo "</channel>\n</rss>\n";
    exit;
}

// ── Páginas HTML ──────────────────────────────────────────────
$about = loadAbout($db);
$author = ['@type' => 'Person', 'name' => $about['name'], 'url' => $site['origin'] . '/sobre-mi'];
$navCats = $db->query(
    "SELECT c.id, c.label FROM categories c
     WHERE EXISTS (SELECT 1 FROM posts p WHERE p.category_id = c.id AND p.status = 'published')
     ORDER BY c.sort_order, c.label"
)->fetchAll();

$status = 200;
$meta   = [];
$body   = '';
$url    = fn(string $p = '') => $site['origin'] . '/' . $p;

switch ($section) {
    case '': // Portada
        $posts = publishedPosts($db);
        $meta = [
            'title'       => $site['title'] . ($site['description'] ? ' — ' . $site['description'] : ''),
            'og_title'    => $site['title'],
            'description' => $site['description'] ?: 'Blog de ' . $about['name'],
            'canonical'   => $url(),
            'image'       => defaultImage($site),
            'jsonld'      => [[
                '@context' => 'https://schema.org',
                '@type'    => 'WebSite',
                'name'     => $site['title'],
                'url'      => $url(),
                'description' => $site['description'],
                'inLanguage'  => 'es',
                'author'   => $author,
            ]],
        ];
        $body = '<header><h1>' . h($site['title']) . '</h1>'
            . ($site['description'] ? '<p>' . h($site['description']) . '</p>' : '') . '</header>'
            . postListHtml($posts);
        break;

    case 'post':
        $post = $param !== '' ? publishedPost($db, $param) : null;
        if (!$post) { $status = 404; break; }
        $tags  = tagsFor($db, [$post['id']])[$post['id']] ?? [];
        $img   = postImage($db, $site, $post);
        $desc  = postDescription($post);
        $canon = $url('post/' . rawurlencode($post['id']));
        $mod   = modifiedDate($post);

        // Anterior (más antiguo) y siguiente (más reciente), como en la web
        $all = publishedPosts($db);
        $i   = array_search($post['id'], array_column($all, 'id'), true);
        $older = $i !== false ? ($all[$i + 1] ?? null) : null;
        $newer = $i !== false && $i > 0 ? $all[$i - 1] : null;

        $article = [['article:published_time', $post['date']], ['article:modified_time', $mod], ['article:section', $post['category_label']]];
        foreach ($tags as $t) $article[] = ['article:tag', $t];

        $meta = [
            'title'       => $post['title'] . ' — ' . $site['title'],
            'og_title'    => $post['title'],
            'description' => $desc,
            'canonical'   => $canon,
            'type'        => 'article',
            'image'       => $img,
            'article'     => $article,
            'jsonld'      => [
                array_filter([
                    '@context'      => 'https://schema.org',
                    '@type'         => 'BlogPosting',
                    'headline'      => mb_substr($post['title'], 0, 110),
                    'description'   => $desc,
                    'datePublished' => $post['date'],
                    'dateModified'  => $mod,
                    'author'        => $author,
                    'publisher'     => $author,
                    'mainEntityOfPage' => $canon,
                    'url'           => $canon,
                    'image'         => $img['url'],
                    'articleSection'=> $post['category_label'],
                    'keywords'      => $tags ? implode(', ', $tags) : null,
                    'inLanguage'    => 'es',
                ], fn($v) => $v !== null && $v !== ''),
                [
                    '@context' => 'https://schema.org',
                    '@type'    => 'BreadcrumbList',
                    'itemListElement' => [
                        ['@type' => 'ListItem', 'position' => 1, 'name' => $site['title'], 'item' => $url()],
                        ['@type' => 'ListItem', 'position' => 2, 'name' => $post['category_label'], 'item' => $url('categoria/' . rawurlencode($post['category_id']))],
                        ['@type' => 'ListItem', 'position' => 3, 'name' => $post['title'], 'item' => $canon],
                    ],
                ],
            ],
        ];
        $pn = '';
        if ($older) $pn .= '<a rel="prev" href="post/' . h(rawurlencode($older['id'])) . '">← ' . h($older['title']) . '</a>';
        if ($newer) $pn .= ($pn ? ' · ' : '') . '<a rel="next" href="post/' . h(rawurlencode($newer['id'])) . '">' . h($newer['title']) . ' →</a>';
        $body = '<nav class="ssr-crumbs" aria-label="Ruta"><a href="./">Inicio</a> › '
            . '<a href="categoria/' . h(rawurlencode($post['category_id'])) . '">' . h($post['category_label']) . '</a></nav>'
            . '<article><h1>' . h($post['title']) . '</h1>'
            . '<p class="ssr-meta"><time datetime="' . h($post['date']) . '">' . h(fmtDate($post['date'])) . '</time> · ' . h($about['name']) . '</p>'
            . '<div class="md ssr-body">' . markdownHtml($post['body']) . '</div>'
            . tagLinks($tags) . '</article>'
            . ($pn ? '<nav class="ssr-prevnext" aria-label="Más posts">' . $pn . '</nav>' : '');
        break;

    case 'categoria':
        $cat   = $param !== '' ? categoryById($db, $param) : null;
        $posts = $cat ? publishedPosts($db, 'p.category_id = ?', [$cat['id']]) : [];
        if (!$posts) { $status = 404; break; }
        $meta = [
            'title'       => $cat['label'] . ' — ' . $site['title'],
            'og_title'    => $cat['label'],
            'description' => $cat['description'] ?: 'Posts sobre ' . $cat['label'] . ' en ' . $site['title'],
            'canonical'   => $url('categoria/' . rawurlencode($cat['id'])),
            'image'       => defaultImage($site),
        ];
        $body = '<header><h1>' . h($cat['label']) . '</h1>' . ($cat['description'] ? '<p>' . h($cat['description']) . '</p>' : '') . '</header>'
            . postListHtml($posts);
        break;

    case 'tag':
        $posts = $param !== '' ? publishedPosts($db,
            'EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id AND t.name = ?)', [$param]) : [];
        if (!$posts) { $status = 404; break; }
        $meta = [
            'title'       => '#' . $param . ' — ' . $site['title'],
            'description' => 'Posts con la etiqueta «' . $param . '» en ' . $site['title'],
            'canonical'   => $url('tag/' . rawurlencode($param)),
            'robots'      => 'noindex, follow', // listados finos: que indexe los posts, no el tag
        ];
        $body = '<header><h1>#' . h($param) . '</h1></header>' . postListHtml($posts);
        break;

    case 'sobre-mi':
        if ($param !== '') { $status = 404; break; }
        $img = imageMeta($db, $site['origin'], $about['avatar'] ?: null, $about['name']) ?? defaultImage($site);
        $sameAs = array_values(array_filter(array_map(fn($l) => $l['url'] ?? '', $about['links']), fn($u) => str_starts_with($u, 'https://')));
        $meta = [
            'title'       => 'Sobre mí — ' . $site['title'],
            'og_title'    => $about['name'],
            'description' => plainText($about['bio']) ?: $about['role'],
            'canonical'   => $url('sobre-mi'),
            'type'        => 'profile',
            'image'       => $img,
            'jsonld'      => [[
                '@context'   => 'https://schema.org',
                '@type'      => 'ProfilePage',
                'url'        => $url('sobre-mi'),
                'mainEntity' => array_filter($author + [
                    'description' => $about['role'],
                    'image'       => $about['avatar'] ? $img['url'] : null,
                    'sameAs'      => $sameAs ?: null,
                ]),
            ]],
        ];
        $links = '';
        foreach ($about['links'] as $l) {
            $links .= '<li>' . h($l['label']) . ': ' . (!empty($l['url'])
                ? '<a href="' . h($l['url']) . '" rel="me noopener">' . h($l['text']) . '</a>'
                : h($l['text'])) . '</li>';
        }
        $body = '<article><h1>' . h($about['name']) . '</h1>'
            . ($about['role'] ? '<p class="ssr-meta">' . h($about['role']) . '</p>' : '')
            . '<div class="md ssr-body">' . markdownHtml($about['bio']) . '</div>'
            . ($links ? '<ul>' . $links . '</ul>' : '') . '</article>';
        break;

    case 'contacto':
        if ($param !== '') { $status = 404; break; }
        $meta = ['title' => 'Contacto — ' . $site['title'], 'description' => 'Escríbeme desde el formulario de contacto de ' . $site['title'] . '.', 'canonical' => $url('contacto')];
        $body = '<h1>Contacto</h1><p>El formulario de contacto necesita JavaScript.</p>';
        break;

    case 'buscar':
    case 'terminal':
        // Útiles para el visitante, sin valor en un buscador
        $meta = ['title' => ($section === 'buscar' ? 'Buscar' : 'Terminal') . ' — ' . $site['title'], 'robots' => 'noindex, follow'];
        break;

    default:
        $status = 404;
}

if ($status === 404) {
    $meta = ['title' => 'Página no encontrada — ' . $site['title'], 'robots' => 'noindex'];
    $body = '<h1>Página no encontrada</h1><p><a href="./">Volver al blog</a></p>';
}

http_response_code($status);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
echo render($meta, pageShell($body, $site, $navCats), $site, $base);

// ── Plantilla: index.html con el <head> y el contenido de la página ──
function render(array $meta, string $content, array $site, string $base): string {
    $tpl = file_get_contents(__DIR__ . '/index.html');
    $tpl = preg_replace('#<!--seo-->.*?<!--/seo-->#s', '<!--seo-->' . "\n" . strtr(renderHead($meta, $site, $base), ['\\' => '\\\\', '$' => '\\$']) . "\n" . '<!--/seo-->', $tpl, 1) ?? $tpl;
    return str_replace('<div id="root"></div>', '<div id="root">' . $content . '</div>', $tpl);
}
