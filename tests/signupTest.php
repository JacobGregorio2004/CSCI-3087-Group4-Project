<?php
declare(strict_types=1);
require_once __DIR__ . '/testHelpers.php';
runChecks(function (): void {
    // Precondition: isolated test DB starts without this account.
    verify(testSignup('ci-signup@example.test', 'StrongTestPassword!23'), 'Valid signup creates account');
    verify(!testSignup('ci-signup@example.test', 'StrongTestPassword!23'), 'Duplicate email is rejected');
    verify(!testSignup('not-an-email', 'StrongTestPassword!23'), 'Malformed email is rejected');
    verify(!testSignup('', ''), 'Blank signup is rejected');
});
