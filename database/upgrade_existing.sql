-- MyPlanner+ additions for the EXISTING group4f26 database.
-- Back up the database before running this file.
-- No DROP TABLE, TRUNCATE, or DELETE statements are used here.
-- Run as: mariadb -u group4f26 -p group4f26 < upgrade_existing.sql

USE group4f26;

-- The original JavaScript uses string IDs, categories and optional details.
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS client_id VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'school',
    ADD COLUMN IF NOT EXISTS description TEXT NULL,
    ADD COLUMN IF NOT EXISTS due_date DATE NULL;

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS client_id VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'other',
    ADD COLUMN IF NOT EXISTS description TEXT NULL,
    ADD COLUMN IF NOT EXISTS start_time TIME NULL,
    ADD COLUMN IF NOT EXISTS end_time TIME NULL,
    ADD COLUMN IF NOT EXISTS week_task_done TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS client_id VARCHAR(100) NULL;

-- Keep a stable key for custom tabs (the UI uses string keys).
ALTER TABLE folders
    ADD COLUMN IF NOT EXISTS folder_key VARCHAR(50) NULL;

UPDATE folders
SET folder_key = CONCAT('custom_legacy_', folder_id)
WHERE folder_key IS NULL;

-- Extra UI data that does not fit the original seven tables.
CREATE TABLE IF NOT EXISTS planner_preferences (
    user_id INT NOT NULL PRIMARY KEY,
    starting_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    board_stickers LONGTEXT NOT NULL,
    calendar_decorations LONGTEXT NOT NULL,
    CONSTRAINT fk_planner_preferences_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bills (
    bill_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    due_date DATE NULL,
    paid TINYINT(1) NOT NULL DEFAULT 0,
    INDEX idx_bills_user (user_id),
    CONSTRAINT fk_bills_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
