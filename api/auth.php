<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $user = null;
    if (isset($_SESSION['user_id'])) {
        $stmt = database()->prepare('SELECT user_id, username, email FROM users WHERE user_id = ?');
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch() ?: null;
        if (!$user) {
            unset($_SESSION['user_id']);
        }
    }
    json_response(200, [
        'authenticated' => $user !== null,
        'user' => $user ? [
            'user_id' => (int)$user['user_id'],
            'name' => $user['username'],
            'email' => $user['email']
        ] : null,
        'csrfToken' => csrf_token()
    ]);
}

method('POST');
require_csrf();
$data = body();
$action = $data['action'] ?? '';

if ($action === 'logout') {
    $_SESSION = [];
    session_regenerate_id(true);
    json_response(200, ['ok' => true]);
}
if ($action !== 'login' && $action !== 'register') {
    json_response(400, ['error' => 'Unknown action.']);
}

$login = required_string($data['email'] ?? null, 100, 'Email or username');
$password = $data['password'] ?? null;
if (!is_string($password)) {
    json_response(422, ['error' => 'Enter a password.']);
}

$db = database();
if ($action === 'register') {
    $username = required_string($data['name'] ?? null, 50, 'Username');
    $email = strtolower($login);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(422, ['error' => 'Enter a valid email address.']);
    }
    if (strlen($password) < 8 || strlen($password) > 256) {
        json_response(422, ['error' => 'Password must be between 8 and 256 characters.']);
    }
    try {
        $stmt = $db->prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
        $stmt->execute([$username, $email, password_hash($password, PASSWORD_DEFAULT)]);
        $userId = (int)$db->lastInsertId();
    } catch (PDOException $exception) {
        if ($exception->getCode() === '23000') {
            json_response(409, ['error' => 'Username or email is already in use.']);
        }
        server_error($exception);
    }
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    json_response(201, [
        'ok' => true, 'csrfToken' => csrf_token(),
        'user' => ['user_id' => $userId, 'name' => $username, 'email' => $email]
    ]);
}

if ($password === '' || strlen($password) > 256) {
    json_response(401, ['error' => 'Incorrect email or password.']);
}
// A modest per-session limit; internet-facing applications need stronger protection.
if (($_SESSION['locked_until'] ?? 0) > time()) {
    json_response(429, ['error' => 'Too many attempts. Try again in a few minutes.']);
}
// Existing Turing accounts can sign in with their username or email.
$stmt = $db->prepare('SELECT user_id, username, email, password_hash FROM users
                      WHERE username = ? OR email = ? LIMIT 1');
$stmt->execute([$login, strtolower($login)]);
$user = $stmt->fetch();
if (!$user || !password_verify($password, $user['password_hash'])) {
    $_SESSION['failed_logins'] = ($_SESSION['failed_logins'] ?? 0) + 1;
    if ($_SESSION['failed_logins'] >= 5) {
        $_SESSION['locked_until'] = time() + 300;
    }
    json_response(401, ['error' => 'Incorrect email or password.']);
}
if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
    $update = $db->prepare('UPDATE users SET password_hash = ? WHERE user_id = ?');
    $update->execute([password_hash($password, PASSWORD_DEFAULT), $user['user_id']]);
}
session_regenerate_id(true);
$_SESSION['user_id'] = (int)$user['user_id'];
$_SESSION['csrf'] = bin2hex(random_bytes(32));
unset($_SESSION['failed_logins'], $_SESSION['locked_until']);
json_response(200, [
    'ok' => true, 'csrfToken' => csrf_token(),
    'user' => [
        'user_id' => (int)$user['user_id'],
        'name' => $user['username'], 'email' => $user['email']
    ]
]);
