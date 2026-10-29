<?php
declare(strict_types=1);
require_once __DIR__ . '/testHelpers.php';
runChecks(function (): void {
    // Precondition: adapter creates an isolated test user with this email/password.
    verify(testLogin('ci-login@example.test', 'CorrectTestPassword!23'), 'Valid credentials allow login');
    verify(!testLogin('ci-login@example.test', 'WrongPassword!23'), 'Wrong password is rejected');
    verify(!testLogin('unknown@example.test', 'CorrectTestPassword!23'), 'Unknown email is rejected');
    verify(!testLogin('', ''), 'Empty credentials are rejected');
    verify(!testLogin("' OR 1=1 --", 'anything'), 'SQL injection string cannot authenticate');
});
