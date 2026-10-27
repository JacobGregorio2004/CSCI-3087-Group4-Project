<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$userId = current_user_id();
$db = database();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare('SELECT bill_id, name, amount, due_date, paid FROM bills
                          WHERE user_id = ? ORDER BY due_date, bill_id');
    $stmt->execute([$userId]);
    $bills = array_map(static function (array $bill): array {
        return [
            'bill_id' => (int)$bill['bill_id'],
            'name' => $bill['name'],
            'amountCents' => decimal_to_cents($bill['amount']),
            'due_date' => $bill['due_date'],
            'paid' => (bool)$bill['paid']
        ];
    }, $stmt->fetchAll());
    json_response(200, ['ok' => true, 'bills' => $bills]);
}

method('POST');
require_csrf();
$data = body();
$action = $data['action'] ?? '';

if ($action === 'delete') {
    $id = filter_var($data['bill_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false) {
        json_response(422, ['error' => 'Invalid bill ID.']);
    }
    execute($db, 'DELETE FROM bills WHERE bill_id = ? AND user_id = ?', [$id, $userId]);
    json_response(200, ['ok' => true]);
}
if ($action !== 'create' && $action !== 'update') {
    json_response(400, ['error' => 'Unknown bill action.']);
}

$name = required_string($data['name'] ?? null, 255, 'Bill name');
$amount = cents_to_decimal(valid_cents($data['amountCents'] ?? null, true));
$dueDate = valid_date($data['due_date'] ?? null, true);
$paid = bool_value($data['paid'] ?? false);

if ($action === 'create') {
    execute($db, 'INSERT INTO bills (user_id, name, amount, due_date, paid)
                  VALUES (?, ?, ?, ?, ?)', [$userId, $name, $amount, $dueDate, $paid]);
    json_response(201, ['ok' => true, 'bill_id' => (int)$db->lastInsertId()]);
}
$id = filter_var($data['bill_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($id === false) {
    json_response(422, ['error' => 'Invalid bill ID.']);
}
execute($db, 'UPDATE bills SET name = ?, amount = ?, due_date = ?, paid = ?
              WHERE bill_id = ? AND user_id = ?', [$name, $amount, $dueDate, $paid, $id, $userId]);
json_response(200, ['ok' => true]);
