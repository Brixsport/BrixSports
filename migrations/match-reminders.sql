-- Match Reminders Migration
-- Adds match_reminders table for scheduled match notifications

CREATE TABLE IF NOT EXISTS match_reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    match_id TEXT NOT NULL,
    reminder_time INTEGER NOT NULL,
    minutes_before INTEGER NOT NULL DEFAULT 15,
    notification_sent INTEGER NOT NULL DEFAULT 0,
    notification_sent_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_match_reminders_user_id ON match_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_match_reminders_match_id ON match_reminders(match_id);
CREATE INDEX IF NOT EXISTS idx_match_reminders_reminder_time ON match_reminders(reminder_time);
CREATE INDEX IF NOT EXISTS idx_match_reminders_notification_sent ON match_reminders(notification_sent);

-- Create composite index for checking pending reminders
CREATE INDEX IF NOT EXISTS idx_match_reminders_pending ON match_reminders(notification_sent, reminder_time);
