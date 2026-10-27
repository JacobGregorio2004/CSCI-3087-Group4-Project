<?php
// Main entry point. All data is loaded from the API after login.
require_once __DIR__ . '/api/bootstrap.php';
header('Content-Type: text/html; charset=utf-8');
header('Location: ' . (isset($_SESSION['user_id']) ? 'MyPlannerPlus.html' : 'login.html'));
exit;
