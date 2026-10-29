<?php
declare(strict_types=1);
require_once __DIR__ . '/testHelpers.php';
runChecks(function (): void {
    // Adapter should log in an isolated test user first, then log out.
    verify(testLogout(), 'Logout destroys authentication and prevents use of old session');
});
