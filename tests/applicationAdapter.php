<?php
// IMPORTANT: This adapter MUST be implemented against your real MyPlanner+ PHP code.
// Do not connect these tests to your production database on Turing.
// Each function should use an isolated test database and return the stated result.
declare(strict_types=1);

function notConfigured(string $name): never {
    throw new RuntimeException("$name is not connected to the MyPlanner+ PHP application. Configure tests/applicationAdapter.php first.");
}

// Login: return true only when an existing test account's credentials are valid.
function testLogin(string $email, string $password): bool { notConfigured(__FUNCTION__); }
// Signup: return true if a test account was created; false on invalid/duplicate email.
function testSignup(string $email, string $password): bool { notConfigured(__FUNCTION__); }
// Logout: return true if the test session is invalidated and authentication is removed.
function testLogout(): bool { notConfigured(__FUNCTION__); }
// Calendar: 'create', 'read', 'update', 'delete' for one test event; return true if successful.
function testCalendar(string $operation): bool { notConfigured(__FUNCTION__); }
// Database: return true only if connection to TEST database succeeds.
function testDatabaseConnection(): bool { notConfigured(__FUNCTION__); }
