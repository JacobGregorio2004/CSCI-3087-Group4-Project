<?php
declare(strict_types=1);
require_once __DIR__ . '/httpTestHelpers.php';
// An isolated CI account is inserted by setup-ci.php before tests start.
$token = getToken();
[$status, $result] = requestApi('POST', ['action'=>'login','email'=>'ci-login@example.test','password'=>'CorrectTestPassword!23'], $token);
check($status === 200 && ($result['ok'] ?? false) === true, 'Valid credentials allow login');
$token = $result['csrfToken'];
[$status] = requestApi('POST', ['action'=>'logout'], $token);
check($status === 200, 'Reset session after successful login');
$token = getToken();
[$status] = requestApi('POST', ['action'=>'login','email'=>'ci-login@example.test','password'=>'WrongPassword!23'], $token);
check($status === 401, 'Wrong password is rejected');
[$status] = requestApi('POST', ['action'=>'login','email'=>'unknown@example.test','password'=>'CorrectTestPassword!23'], $token);
check($status === 401, 'Unknown email is rejected');
[$status] = requestApi('POST', ['action'=>'login','email'=>'','password'=>''], $token);
check($status === 422, 'Empty email is rejected');
[$status] = requestApi('POST', ['action'=>'login','email'=>"' OR 1=1 --",'password'=>'anything'], $token);
check($status === 401, 'SQL injection string cannot authenticate');
