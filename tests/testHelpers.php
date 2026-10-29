<?php
// Shared assertions. An assertion failure exits with a nonzero status for GitHub Actions.
declare(strict_types=1);
function verify(bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, "FAIL: $message\n");
        exit(1);
    }
    echo "PASS: $message\n";
}
function runChecks(callable $checks): void {
    try { $checks(); }
    catch (Throwable $e) { fwrite(STDERR, "FAIL: {$e->getMessage()}\n"); exit(1); }
}
require_once __DIR__ . '/applicationAdapter.php';
