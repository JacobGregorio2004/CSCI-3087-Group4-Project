<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$userId = current_user_id();
$db = database();

function rows_for_user(PDO $db, string $sql, int $userId): array {
    $stmt = $db->prepare($sql);
    $stmt->execute([$userId]);
    return $stmt->fetchAll();
}

function read_json(?string $value, array $fallback): array {
    $decoded = json_decode($value ?? '', true);
    return is_array($decoded) ? $decoded : $fallback;
}

function ensure_preferences(PDO $db, int $userId): void {
    execute($db, 'INSERT IGNORE INTO planner_preferences
                  (user_id, starting_balance, board_stickers, calendar_decorations)
                  VALUES (?, 0.00, ?, ?)', [$userId, '[]', '{}']);
}

function validate_photo($image): void {
    if (!is_string($image) || strlen($image) > 4 * 1024 * 1024 ||
        !preg_match('~^data:image/jpeg;base64,[A-Za-z0-9+/=]+$~D', $image)) {
        json_response(422, ['error' => 'Invalid photo sticker.']);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $events = [];
    foreach (rows_for_user($db, 'SELECT * FROM events WHERE user_id = ? ORDER BY event_date, event_id', $userId) as $row) {
        $events[] = [
            'id' => $row['client_id'] ?: 'legacy_event_' . $row['event_id'],
            'title' => $row['title'], 'date' => $row['event_date'],
            'time' => $row['start_time'] ? substr($row['start_time'], 0, 5) : '',
            'endTime' => $row['end_time'] ? substr($row['end_time'], 0, 5) : '',
            'description' => $row['description'], 'category' => $row['category'] ?: 'other',
            'weekTaskDone' => (bool)$row['week_task_done']
        ];
    }

    $tasks = [];
    foreach (rows_for_user($db, 'SELECT * FROM tasks WHERE user_id = ? ORDER BY task_id', $userId) as $row) {
        $tasks[] = [
            'id' => $row['client_id'] ?: 'legacy_task_' . $row['task_id'],
            'text' => $row['task_text'], 'description' => $row['description'],
            'category' => $row['category'] ?: 'school', 'dueDate' => $row['due_date'],
            'done' => (bool)$row['completed']
        ];
    }

    $transactions = [];
    foreach (rows_for_user($db, 'SELECT * FROM transactions WHERE user_id = ? ORDER BY transaction_date, transaction_id', $userId) as $row) {
        $transactions[] = [
            'id' => $row['client_id'] ?: 'legacy_transaction_' . $row['transaction_id'],
            'type' => $row['transaction_type'],
            'title' => $row['description'] ?: $row['category'],
            'category' => $row['category'],
            'date' => $row['transaction_date'],
            'amountCents' => decimal_to_cents($row['amount'])
        ];
    }

    $budgets = [];
    foreach (rows_for_user($db, 'SELECT period_type, start_date, budget_amount FROM budgets WHERE user_id = ? ORDER BY budget_id', $userId) as $row) {
        $period = $row['period_type'] === 'weekly' ? 'week' : 'month';
        $budgets[$period . ':' . $row['start_date']] = decimal_to_cents($row['budget_amount']);
    }

    $folders = [];
    foreach (rows_for_user($db, 'SELECT folder_id, folder_name, folder_key FROM folders WHERE user_id = ? ORDER BY folder_id', $userId) as $row) {
        $folders[] = [
            'key' => $row['folder_key'] ?: 'custom_legacy_' . $row['folder_id'],
            'name' => $row['folder_name']
        ];
    }
    $prefs = rows_for_user($db, 'SELECT * FROM planner_preferences WHERE user_id = ?', $userId);
    $pref = $prefs[0] ?? null;

    json_response(200, ['ok' => true, 'state' => [
        'events' => $events,
        'tasks' => $tasks,
        'customCategories' => $folders,
        'boardStickers' => read_json($pref['board_stickers'] ?? null, []),
        'calendarDecorations' => (object)read_json($pref['calendar_decorations'] ?? null, []),
        'finance' => [
            'startingBalanceCents' => $pref ? decimal_to_cents($pref['starting_balance']) : 0,
            'budgets' => (object)$budgets,
            'transactions' => $transactions
        ]
    ]]);
}

method('POST');
require_csrf();
$request = body();
$section = $request['section'] ?? '';
$data = $request['data'] ?? null;
if (!in_array($section, ['planner', 'board', 'calendarDecorations', 'finance'], true)) {
    json_response(400, ['error' => 'Unknown section.']);
}

try {
    $db->beginTransaction();
    ensure_preferences($db, $userId);

    if ($section === 'planner') {
        if (!is_array($data) || !isset($data['events'], $data['tasks'], $data['customCategories'])) {
            json_response(422, ['error' => 'Invalid planner data.']);
        }
        $events = valid_items($data['events'], 1000, 'events');
        $tasks = valid_items($data['tasks'], 1000, 'tasks');
        $folders = valid_items($data['customCategories'], 100, 'folders');

        // Update only this account's records. Do not modify teammates' accounts.
        execute($db, 'DELETE FROM events WHERE user_id = ?', [$userId]);
        execute($db, 'DELETE FROM tasks WHERE user_id = ?', [$userId]);
        $eventInsert = $db->prepare('INSERT INTO events
            (user_id, folder_id, client_id, title, event_date, color, category,
             description, start_time, end_time, week_task_done)
            VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($events as $event) {
            if (!is_array($event)) {
                json_response(422, ['error' => 'Invalid event.']);
            }
            $eventInsert->execute([
                $userId,
                validate_client_id($event['id'] ?? null),
                required_string($event['title'] ?? null, 150, 'Event title'),
                valid_date($event['date'] ?? null),
                'pink',
                optional_string($event['category'] ?? null, 50, 'Category') ?: 'other',
                optional_string($event['description'] ?? null, 5000, 'Description'),
                valid_time($event['time'] ?? null),
                valid_time($event['endTime'] ?? null),
                bool_value($event['weekTaskDone'] ?? false)
            ]);
        }
        $taskInsert = $db->prepare('INSERT INTO tasks
            (user_id, folder_id, client_id, task_text, completed, category, description, due_date)
            VALUES (?, NULL, ?, ?, ?, ?, ?, ?)');
        foreach ($tasks as $task) {
            if (!is_array($task)) {
                json_response(422, ['error' => 'Invalid task.']);
            }
            $taskInsert->execute([
                $userId,
                validate_client_id($task['id'] ?? null),
                required_string($task['text'] ?? null, 255, 'Task text'),
                bool_value($task['done'] ?? false),
                optional_string($task['category'] ?? null, 50, 'Category') ?: 'school',
                optional_string($task['description'] ?? null, 5000, 'Description'),
                valid_date($task['dueDate'] ?? null, true)
            ]);
        }

        execute($db, "DELETE FROM folders WHERE user_id = ? AND LEFT(folder_key, 7) = 'custom_'", [$userId]);
        $folderInsert = $db->prepare('INSERT INTO folders (user_id, folder_name, color, folder_key)
                                      VALUES (?, ?, ?, ?)');
        foreach ($folders as $folder) {
            if (!is_array($folder)) {
                json_response(422, ['error' => 'Invalid folder.']);
            }
            $key = required_string($folder['key'] ?? null, 50, 'Folder key');
            if (!preg_match('/^custom_[A-Za-z0-9_-]+$/D', $key)) {
                json_response(422, ['error' => 'Invalid folder key.']);
            }
            $folderInsert->execute([
                $userId, required_string($folder['name'] ?? null, 25, 'Folder name'), 'pink', $key
            ]);
        }
    } elseif ($section === 'board') {
        $stickers = valid_items($data, 200, 'stickers');
        foreach ($stickers as $sticker) {
            if (!is_array($sticker) || !in_array($sticker['type'] ?? '', ['emoji', 'note', 'photo'], true)) {
                json_response(422, ['error' => 'Invalid sticker.']);
            }
            validate_client_id($sticker['id'] ?? null);
            foreach (['x', 'y'] as $axis) {
                if (!isset($sticker[$axis]) || !is_numeric($sticker[$axis]) ||
                    $sticker[$axis] < 0 || $sticker[$axis] > 100) {
                    json_response(422, ['error' => 'Invalid sticker position.']);
                }
            }
            if ($sticker['type'] === 'photo') {
                validate_photo($sticker['src'] ?? null);
            }
            if ($sticker['type'] === 'note') {
                optional_string($sticker['text'] ?? null, 3000, 'Note text');
            }
        }
        execute($db, 'UPDATE planner_preferences SET board_stickers = ? WHERE user_id = ?',
            [json_encode($stickers, JSON_UNESCAPED_UNICODE), $userId]);
    } elseif ($section === 'calendarDecorations') {
        if (!is_array($data) || count($data) > 2000 || (array_is_list($data) && $data !== [])) {
            json_response(422, ['error' => 'Invalid calendar decorations.']);
        }
        foreach ($data as $date => $stickers) {
            valid_date($date);
            valid_items($stickers, 100, 'calendar stickers');
            foreach ($stickers as $sticker) {
                if (!is_array($sticker) || !in_array($sticker['type'] ?? '', ['emoji', 'photo'], true)) {
                    json_response(422, ['error' => 'Invalid calendar sticker.']);
                }
                if ($sticker['type'] === 'photo') {
                    validate_photo($sticker['src'] ?? null);
                } else {
                    required_string($sticker['emoji'] ?? null, 32, 'Emoji');
                }
            }
        }
        execute($db, 'UPDATE planner_preferences SET calendar_decorations = ? WHERE user_id = ?',
            [json_encode((object)$data, JSON_UNESCAPED_UNICODE), $userId]);
    } else {
        if (!is_array($data) || !isset($data['startingBalanceCents'], $data['budgets'], $data['transactions'])) {
            json_response(422, ['error' => 'Invalid finance data.']);
        }
        $starting = valid_cents($data['startingBalanceCents'], true);
        $budgets = $data['budgets'];
        if (!is_array($budgets) || count($budgets) > 400) {
            json_response(422, ['error' => 'Invalid budgets.']);
        }
        $transactions = valid_items($data['transactions'], 2000, 'transactions');
        execute($db, 'UPDATE planner_preferences SET starting_balance = ? WHERE user_id = ?',
            [cents_to_decimal($starting), $userId]);

        execute($db, 'DELETE FROM budgets WHERE user_id = ?', [$userId]);
        $budgetInsert = $db->prepare('INSERT INTO budgets (user_id, period_type, start_date, budget_amount)
                                      VALUES (?, ?, ?, ?)');
        foreach ($budgets as $period => $amount) {
            if (!is_string($period) || !preg_match('/^(week|month):(\d{4}-\d{2}-\d{2})$/D', $period, $parts)) {
                json_response(422, ['error' => 'Invalid budget period.']);
            }
            $budgetInsert->execute([
                $userId, $parts[1] === 'week' ? 'weekly' : 'monthly',
                valid_date($parts[2]), cents_to_decimal(valid_cents($amount, true))
            ]);
        }

        execute($db, 'DELETE FROM transactions WHERE user_id = ?', [$userId]);
        $transactionInsert = $db->prepare('INSERT INTO transactions
            (user_id, client_id, transaction_type, category, amount, description, transaction_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)');
        foreach ($transactions as $transaction) {
            if (!is_array($transaction) || !in_array($transaction['type'] ?? '', ['income', 'expense'], true)) {
                json_response(422, ['error' => 'Invalid transaction.']);
            }
            $transactionInsert->execute([
                $userId, validate_client_id($transaction['id'] ?? null),
                $transaction['type'],
                required_string($transaction['category'] ?? null, 100, 'Category'),
                cents_to_decimal(valid_cents($transaction['amountCents'] ?? null)),
                required_string($transaction['title'] ?? null, 255, 'Description'),
                valid_date($transaction['date'] ?? null)
            ]);
        }
    }

    $db->commit();
    json_response(200, ['ok' => true]);
} catch (Throwable $exception) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    server_error($exception);
}
