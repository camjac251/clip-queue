/**
 * Migration: Add play_log table for complete play history tracking
 * Date: 2025-10-14
 *
 * Implements proper play event logging:
 * - Creates play_log table to track every play event
 * - Supports replays (multiple plays of same clip)
 * - Tracks watch time (playedFor) and completion (completedAt)
 * - Removes playedAt from clips (moved to play_log)
 *
 * Benefits:
 * - True chronological history (no overwrites on replay)
 * - Analytics support (most played, watch time, etc.)
 */
CREATE TABLE `play_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clip_id` text NOT NULL,
	`played_at` integer DEFAULT (unixepoch()) NOT NULL,
	`played_for` integer,
	`completed_at` integer,
	FOREIGN KEY (`clip_id`) REFERENCES `clips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_play_log_clip_id` ON `play_log` (`clip_id`);--> statement-breakpoint
CREATE INDEX `idx_play_log_played_at` ON `play_log` (`played_at`);--> statement-breakpoint
DROP INDEX `idx_clips_played_at`;--> statement-breakpoint
ALTER TABLE `clips` DROP COLUMN `played_at`;