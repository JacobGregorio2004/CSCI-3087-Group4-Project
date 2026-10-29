<?php
declare(strict_types=1);
// Connects ONLY to the isolated GitHub Actions database, never Turing.
require_once __DIR__ . '/ciDb.php';
$pdo = getDatabaseConnection();
if (!$pdo instanceof PDO || $pdo->query('SELECT 1')->fetchColumn() != 1) {
    fwrite(STDERR, "FAIL: database query\n"); exit(1);
}
echo "PASS: test MySQL database connection and query\n";
