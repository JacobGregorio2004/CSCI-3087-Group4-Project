<?php
declare(strict_types=1);
require_once __DIR__ . '/ciDb.php';
$db = getDatabaseConnection();
$db->exec('CREATE TABLE IF NOT EXISTS users (user_id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(50) NOT NULL UNIQUE, email VARCHAR(100) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL) ENGINE=InnoDB');
$stmt = $db->prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
$stmt->execute(['ci-login','ci-login@example.test',password_hash('CorrectTestPassword!23', PASSWORD_DEFAULT)]);
echo "Temporary test database initialized\n";
