<?php
declare(strict_types=1);
require_once __DIR__ . '/httpTestHelpers.php';
$token = getToken();
[$status, $result] = requestApi('POST', ['action'=>'login','email'=>'ci-login@example.test','password'=>'CorrectTestPassword!23'], $token);
check($status === 200 && ($result['ok'] ?? false), 'Login before logout');
[$status, $user] = requestApi();
check($status === 200 && $user['authenticated'] === true, 'Session is authenticated');
[$status] = requestApi('POST', ['action'=>'logout'], $result['csrfToken']);
check($status === 200, 'Logout request succeeds');
[$status, $user] = requestApi();
check($status === 200 && $user['authenticated'] === false, 'Session is unauthenticated after logout');
