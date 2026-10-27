<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
ini_set('session.use_strict_mode', '1');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Lax'
]);
session_start();

// Return a JSON error instead of an HTML stack trace if a request fails.
set_exception_handler(static function (Throwable $error): void {
    server_error($error);
});

function json_response(int $code, array $body): void {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function method(string $expected): void {
    if ($_SERVER['REQUEST_METHOD'] !== $expected) {
        header('Allow: ' . $expected);
        json_response(405, ['error' => 'Method not allowed.']);
    }
}

function database(): PDO {
    static $connection;
    if (isset($connection)) {
        return $connection;
    }
    // The existing Turing project keeps database passwords outside public_html.
    $settingsFile = __DIR__ . '/config.php';
    $settings = is_file($settingsFile)
        ? require $settingsFile
        : ['private_db_file' => '/home/group4f26/MyPlannerPHP-private/db.php'];
    $privateFile = $settings['private_db_file'] ?? '';
    if (!is_string($privateFile) || !is_file($privateFile)) {
        json_response(500, ['error' => 'Private database connection file not found.']);
    }
    try {
        require_once $privateFile;
        if (!function_exists('getDatabaseConnection')) {
            throw new RuntimeException('Private DB file must provide getDatabaseConnection().');
        }
        $connection = getDatabaseConnection();
        if (!$connection instanceof PDO) {
            throw new RuntimeException('Database connection did not return PDO.');
        }
        $connection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $connection->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $connection->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
        return $connection;
    } catch (Throwable $exception) {
        error_log('MyPlanner+ DB connection error: ' . $exception->getMessage());
        json_response(503, ['error' => 'Could not connect to the database.']);
    }
}

function body(): array {
    $raw = file_get_contents('php://input', false, null, 0, 6 * 1024 * 1024 + 1);
    if ($raw === false || strlen($raw) > 6 * 1024 * 1024) {
        json_response(413, ['error' => 'Request is too large.']);
    }
    try {
        $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        json_response(400, ['error' => 'Invalid JSON.']);
    }
    if (!is_array($data) || array_is_list($data)) {
        json_response(400, ['error' => 'Expected a JSON object.']);
    }
    return $data;
}

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function require_csrf(): void {
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($provided) || !hash_equals(csrf_token(), $provided)) {
        json_response(403, ['error' => 'Invalid security token. Reload the page and try again.']);
    }
}

function current_user_id(): int {
    $id = $_SESSION['user_id'] ?? null;
    if (!is_int($id) && !(is_string($id) && ctype_digit($id))) {
        json_response(401, ['error' => 'Please log in.']);
    }
    if ((int)$id < 1) {
        json_response(401, ['error' => 'Please log in.']);
    }
    return (int)$id;
}

function required_string($value, int $max, string $field): string {
    if (!is_string($value) || trim($value) === '' || strlen($value) > $max) {
        json_response(422, ['error' => "$field must be 1-$max characters."]);
    }
    return trim($value);
}

function optional_string($value, int $max, string $field): ?string {
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_string($value) || strlen($value) > $max) {
        json_response(422, ['error' => "$field is too long or invalid."]);
    }
    return $value;
}

function valid_date($value, bool $optional = false): ?string {
    if ($optional && ($value === null || $value === '')) {
        return null;
    }
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) {
        json_response(422, ['error' => 'Invalid date.']);
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) {
        json_response(422, ['error' => 'Invalid date.']);
    }
    return $value;
}

function valid_time($value): ?string {
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_string($value) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/D', $value)) {
        json_response(422, ['error' => 'Invalid time.']);
    }
    return strlen($value) === 5 ? $value . ':00' : $value;
}

function valid_cents($value, bool $allowZero = false): int {
    // Limit values to the range accepted by the finance form.
    if (!is_int($value) || $value > 9999999999 || ($allowZero ? $value < 0 : $value <= 0)) {
        json_response(422, ['error' => 'Invalid monetary amount.']);
    }
    return $value;
}

function cents_to_decimal(int $cents): string {
    return intdiv($cents, 100) . '.' . str_pad((string)($cents % 100), 2, '0', STR_PAD_LEFT);
}

function decimal_to_cents(string $decimal): int {
    $parts = explode('.', $decimal);
    return (int)$parts[0] * 100 + (int)str_pad($parts[1] ?? '', 2, '0');
}

function valid_items($data, int $max, string $name): array {
    if (!is_array($data) || !array_is_list($data) || count($data) > $max) {
        json_response(422, ['error' => "Invalid $name list."]);
    }
    return $data;
}

function validate_client_id($id): string {
    return required_string($id, 100, 'ID');
}

function bool_value($value): int {
    return $value === true ? 1 : 0;
}

function execute(PDO $db, string $sql, array $params): void {
    $statement = $db->prepare($sql);
    $statement->execute($params);
}

function server_error(Throwable $exception): void {
    error_log('MyPlanner+ request error: ' . $exception->getMessage());
    json_response(500, ['error' => 'Could not complete the request.']);
}
