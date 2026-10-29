<?php
declare(strict_types=1);
require_once __DIR__ . '/httpTestHelpers.php';
$token = getToken();
[$status] = requestApi('POST', ['action'=>'register','name'=>'testsignup','email'=>'signup@example.test','password'=>'SafePassword!23'], $token);
check($status === 201, 'A new user can register');
$token = getToken();
[$status] = requestApi('POST', ['action'=>'register','name'=>'duplicate','email'=>'signup@example.test','password'=>'SafePassword!23'], $token);
check($status === 409, 'Duplicate email is rejected');
[$status] = requestApi('POST', ['action'=>'register','name'=>'bademail','email'=>'not-an-email','password'=>'SafePassword!23'], $token);
check($status === 422, 'Invalid email is rejected');
[$status] = requestApi('POST', ['action'=>'register','name'=>'shortpass','email'=>'short@example.test','password'=>'short'], $token);
check($status === 422, 'Short password is rejected');
