<?php
function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $envPaths = [
        __DIR__ . '/../../../../.env',
        __DIR__ . '/../../../.env',
        __DIR__ . '/../../.env',
    ];
    $env = [];
    foreach ($envPaths as $path) {
        if (file_exists($path)) {
            $env = parse_ini_file($path);
            if ($env) break;
        }
    }

    $host = $env['DB_HOST'] ?? 'localhost';
    $name = $env['DB_NAME'] ?? 'jrobertoma';
    $user = $env['DB_USER'] ?? '';
    $pass = $env['DB_PASS'] ?? '';

    $pdo = new PDO(
        "mysql:host={$host};dbname={$name};charset=utf8mb4",
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
    return $pdo;
}

function envVar(string $key, string $default = ''): string {
    static $env = null;
    if ($env === null) {
        $paths = [
            __DIR__ . '/../../../../.env',
            __DIR__ . '/../../../.env',
            __DIR__ . '/../../.env',
        ];
        $env = [];
        foreach ($paths as $path) {
            if (file_exists($path)) {
                $parsed = parse_ini_file($path);
                if ($parsed) { $env = $parsed; break; }
            }
        }
    }
    return (string)($env[$key] ?? $default);
}
