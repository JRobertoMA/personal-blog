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
        $whole = rtrim($value);
        if (strlen($whole) >= 2 && $whole[0] === '"' && substr($whole, -1) === '"') {
            // Todo el valor entre comillas dobles: se toma hasta la ÚLTIMA comilla,
            // así una contraseña con " o # dentro no se corta en la primera.
            $value = strtr(substr($whole, 1, -1), ['\\"' => '"', '\\\\' => '\\']);
        } elseif (preg_match('/^"((?:[^"\\\\]|\\\\.)*)"/', $value, $q)) {
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
    return envState()['vars'];
}

// Carpeta donde está el .env usado (null si no se encontró ninguno)
function envDir(): ?string {
    return envState()['dir'];
}

function envState(): array {
    static $state = null;
    if ($state !== null) return $state;
    $paths = [
        __DIR__ . '/../../../../.env',
        __DIR__ . '/../../../.env',
        __DIR__ . '/../../.env',
    ];
    $state = ['vars' => [], 'dir' => null];
    foreach ($paths as $path) {
        if (!is_readable($path)) continue;
        $parsed = parseEnvFile($path);
        if (isset($parsed['DB_NAME'])) { $state = ['vars' => $parsed, 'dir' => dirname(realpath($path))]; break; }
    }
    if (!$state['vars']) error_log('[jrobertoma api] No se encontró un .env válido con DB_NAME');
    return $state;
}

// Registro de errores de la API. En hosting compartido (IONOS) el log de Apache
// no es accesible: con LOG_FILE en el .env se escribe en un archivo propio.
// Una ruta relativa se resuelve desde la carpeta del .env (fuera de la web).
function apiLog(string $message): void {
    $line = '[jrobertoma api] ' . $message;
    $file = envVar('LOG_FILE');
    if ($file !== '' && $file[0] !== '/' && envDir()) $file = envDir() . '/' . $file;
    if ($file === '' || !@error_log('[' . date('Y-m-d H:i:s') . '] ' . $line . PHP_EOL, 3, $file)) {
        error_log($line); // sin LOG_FILE, o si no se puede escribir: log del servidor
    }
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
