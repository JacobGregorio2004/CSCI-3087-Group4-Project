<?php
declare(strict_types=1);
require_once __DIR__ . '/testHelpers.php';
runChecks(function (): void {
    verify(testDatabaseConnection(), 'MyPlanner+ connects to isolated MySQL test database');
});
