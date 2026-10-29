<?php
declare(strict_types=1);
// HTTP integration helpers: same cookie jar is reused for a session.
const API_URL = 'http://127.0.0.1:8765/api/auth.php';
function check(bool $condition, string $description): void {
    if (!$condition) { fwrite(STDERR, "FAIL: $description\n"); exit(1); }
    echo "PASS: $description\n";
}
function requestApi(string $method = 'GET', ?array $payload = null, ?string $csrf = null): array {
    static $cookieFile;
    $cookieFile ??= tempnam(sys_get_temp_dir(), 'myplanner_ci_');
    $handle = curl_init(API_URL);
    $headers = ['Accept: application/json'];
    if ($payload !== null) $headers[] = 'Content-Type: application/json';
    if ($csrf !== null) $headers[] = 'X-CSRF-Token: ' . $csrf;
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_TIMEOUT => 10,
    ]);
    if ($payload !== null) curl_setopt($handle, CURLOPT_POSTFIELDS, json_encode($payload, JSON_THROW_ON_ERROR));
    $response = curl_exec($handle);
    if ($response === false) { fwrite(STDERR, 'HTTP request failed: ' . curl_error($handle) . "\n"); exit(1); }
    $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    $body = json_decode($response, true);
    check(is_array($body), 'API returned valid JSON');
    return [$status, $body];
}
function getToken(): string {
    [$status, $data] = requestApi();
    check($status === 200 && isset($data['csrfToken']), 'CSRF token is available');
    return $data['csrfToken'];
}
