<?php
// Busca el .env primero FUERA de la carpeta pública (recomendado en IONOS)
// y como último recurso en la raíz del proyecto.
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
        if (is_readable($path)) {
            $parsed = parse_ini_file($path, false, INI_SCANNER_RAW);
            if ($parsed) { $env = $parsed; break; }
        }
    }
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

function clientIp(): string {
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
