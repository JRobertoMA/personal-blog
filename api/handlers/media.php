<?php
requireAuth();

$method    = $GLOBALS['_METHOD'];
$id        = $GLOBALS['_ID'];
$db        = getDB();
$uploadDir = envVar('UPLOAD_PATH', __DIR__ . '/../../uploads/media');
$maxBytes  = (int)envVar('MAX_UPLOAD_BYTES', '10485760');
$allowed   = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

if ($method === 'GET') {
    $rows = $db->query('SELECT * FROM media ORDER BY uploaded_at DESC')->fetchAll();
    foreach ($rows as &$r) {
        $r['url'] = '/uploads/media/' . $r['filename'];
    }
    respond(true, $rows);
}

if (in_array($method, ['POST','DELETE'])) verifyCsrf();

if ($method === 'POST') {
    if (empty($_FILES['file'])) respond(false, 'No se recibió ningún archivo', 400);
    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) respond(false, 'Error al subir el archivo', 400);
    if ($file['size'] > $maxBytes) respond(false, 'Archivo demasiado grande', 400);

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($file['tmp_name']);
    if (!in_array($mime, $allowed)) respond(false, 'Tipo de archivo no permitido', 415);

    $ext      = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'][$mime];
    $filename = hash('sha256', uniqid('', true)) . '.' . $ext;
    $dest     = rtrim($uploadDir, '/') . '/' . $filename;

    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
    if (!move_uploaded_file($file['tmp_name'], $dest)) respond(false, 'Error al guardar el archivo', 500);

    $size = filesize($dest);
    $dims = getimagesize($dest);

    $db->prepare(
        'INSERT INTO media (filename, original_name, mime_type, size_bytes, width, height) VALUES (?,?,?,?,?,?)'
    )->execute([$filename, $file['name'], $mime, $size, $dims[0] ?? null, $dims[1] ?? null]);

    respond(true, ['id' => $db->lastInsertId(), 'filename' => $filename, 'url' => '/uploads/media/' . $filename], 201);
}

if ($method === 'DELETE' && $id) {
    $stmt = $db->prepare('SELECT filename FROM media WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) respond(false, 'Archivo no encontrado', 404);
    $path = rtrim($uploadDir, '/') . '/' . $row['filename'];
    if (file_exists($path)) unlink($path);
    $db->prepare('DELETE FROM media WHERE id = ?')->execute([$id]);
    respond(true, null);
}

respond(false, 'Método no permitido', 405);
