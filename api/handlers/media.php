<?php
$method    = $GLOBALS['_METHOD'];
$id        = $GLOBALS['_ID'];
$db        = getDB();
$projectRoot = realpath(__DIR__ . '/../..');
$uploadDir = envVar('UPLOAD_PATH', 'uploads/media');
// Rutas relativas se resuelven desde la raíz del proyecto (no desde api/)
if ($uploadDir === '' || $uploadDir[0] !== '/') $uploadDir = $projectRoot . '/' . $uploadDir;
$maxBytes  = (int)envVar('MAX_UPLOAD_BYTES', '10485760');
$allowed   = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];

// URL relativa: funciona tanto en la raíz del dominio como en una subcarpeta
$publicUrl = fn(string $filename) => 'uploads/media/' . rawurlencode($filename);

// GET /api/media — público (la galería del sitio lo usa); solo expone lo necesario
if ($method === 'GET') {
    $rows = $db->query('SELECT id, filename, original_name, mime_type, size_bytes, width, height, uploaded_at FROM media ORDER BY uploaded_at DESC')->fetchAll();
    foreach ($rows as &$r) {
        $r['url'] = $publicUrl($r['filename']);
        if (!isAdmin()) unset($r['size_bytes'], $r['uploaded_at']);
    }
    respond(true, $rows);
}

requireAuth();
if (in_array($method, ['POST','DELETE'])) verifyCsrf();

if ($method === 'POST') {
    if (empty($_FILES['file']) || is_array($_FILES['file']['name'])) respond(false, 'No se recibió ningún archivo', 400);
    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) respond(false, 'Error al subir el archivo', 400);
    if ($file['size'] > $maxBytes) respond(false, 'Archivo demasiado grande', 400);

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($file['tmp_name']);
    if (!isset($allowed[$mime])) respond(false, 'Tipo de archivo no permitido', 415);

    $dims = @getimagesize($file['tmp_name']);
    if (!$dims) respond(false, 'La imagen no es válida', 415);

    $filename = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
    $dest     = rtrim($uploadDir, '/') . '/' . $filename;

    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
    if (!move_uploaded_file($file['tmp_name'], $dest)) respond(false, 'Error al guardar el archivo', 500);
    @chmod($dest, 0644);

    $originalName = mb_substr(preg_replace('/[^\p{L}\p{N}._ -]/u', '_', basename((string)$file['name'])), 0, 200);

    $db->prepare(
        'INSERT INTO media (filename, original_name, mime_type, size_bytes, width, height) VALUES (?,?,?,?,?,?)'
    )->execute([$filename, $originalName, $mime, filesize($dest), $dims[0] ?? null, $dims[1] ?? null]);

    respond(true, ['id' => $db->lastInsertId(), 'filename' => $filename, 'url' => $publicUrl($filename)], 201);
}

if ($method === 'DELETE' && $id) {
    $stmt = $db->prepare('SELECT filename FROM media WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) respond(false, 'Archivo no encontrado', 404);
    $path = rtrim($uploadDir, '/') . '/' . basename($row['filename']);
    if (is_file($path)) unlink($path);
    $db->prepare('DELETE FROM media WHERE id = ?')->execute([$id]);
    respond(true, null);
}

respond(false, 'Método no permitido', 405);
