<?php
declare(strict_types=1);
function getDatabaseConnection(): PDO {
    return new PDO('mysql:host=127.0.0.1;dbname=myplanner_ci;charset=utf8mb4', 'ci_user', getenv('CI_DB_PASSWORD') ?: '', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
}
