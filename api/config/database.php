<?php
// Lee un .env sencillo: CLAVE=valor, comentarios con # o ;, valores con o sin
// comillas. No se usa parse_ini_file() porque falla con "#", "(", "!", etc.
function parseEnvFile(string $path): array {
    $vars = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || $line[0] === ';') continue;
        if (!preg_match('/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/', $line, $m)) continue;
        $value = $m[2];
        if (preg_match('/^"((?:[^"\\\\]|\\\\.)*)"/', $value, $q)) {
            $value = strtr($q[1], ['\\"' => '"', '\\\\' => '\\']);
        } elseif (preg_match("/^'([^']*)'/", $value, $q)) {
            $value = $q[1];
        } else {
            $value = trim(preg_replace('/\s+[#;].*$/', '', $value)); // comentario al final de línea
        }
        $vars[$m[1]] = $value;
    }
    return $vars;
}

// Busca el .env primero FUERA de la carpeta pública (recomendado en IONOS)
// y como último recurso en la raíz del proyecto. Solo acepta uno que tenga
// DB_NAME, para no tomar por error el .env de otra aplicación.
function loadEnv(): array {
    static $env = null;
    if ($env !== null) return $env;
    $paths = [
        __DIR__ . '/../../../../.env',
        __DIR__ . '/../../../.env',
        __DIR__ . '/../../.env',
    ];
    $env = [];
    foreach ($paths as $path) {
        if (!is_readable($path)) continue;
        $parsed = parseEnvFile($path);
        if (isset($parsed['DB_NAME'])) { $env = $parsed; break; }
    }
    if (!$env) error_log('[jrobertoma api] No se encontró un .env válido con DB_NAME');
    return $env;
}

function envVar(string $key, string $default = ''): string {
    $env = loadEnv();
    return (string)($env[$key] ?? $default);
}

function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $host = envVar('DB_HOST', 'localhost');
    $name = envVar('DB_NAME', 'jrobertoma');
    $user = envVar('DB_USER');
    $pass = envVar('DB_PASS');

    $port = null;
    if (preg_match('/^(.+):(\d+)$/', $host, $m)) { $host = $m[1]; $port = $m[2]; }
    $dsn = "mysql:host={$host};" . ($port ? "port={$port};" : '') . "dbname={$name};charset=utf8mb4";

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        // Relanzar sin los argumentos del constructor (contienen la contraseña).
        throw new RuntimeException('No se pudo conectar a la base de datos: ' . $e->getMessage());
    }
    return $pdo;
}

// settings.value es TEXT: MariaDB admite como máximo 65 535 BYTES (no caracteres).
// Un emoji ocupa 4 bytes, así que hay que comprobar el tamaño en bytes antes de
// guardar; si no, MariaDB rechaza el valor y el usuario solo ve un error 500.
const SETTINGS_VALUE_MAX_BYTES = 65535;

function fitsSettingsValue(string $value): bool {
    return strlen($value) <= SETTINGS_VALUE_MAX_BYTES;
}

function clientIp(): string {
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
