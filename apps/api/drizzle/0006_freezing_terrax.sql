/**
 * Migration: Make thumbnail_url nullable
 * Date: 2025-11-11
 * Adds Sora platform support where thumbnails may not always be available
 */
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_clips` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`content_type` text DEFAULT 'clip' NOT NULL,
	`clip_id` text NOT NULL,
	`url` text NOT NULL,
	`embed_url` text NOT NULL,
	`video_url` text,
	`thumbnail_url` text,
	`title` text NOT NULL,
	`channel` text NOT NULL,
	`creator` text NOT NULL,
	`category` text,
	`created_at` text,
	`duration` integer,
	`timestamp` integer,
	`status` text DEFAULT 'approved' NOT NULL,
	`submitted_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_clips`("id", "platform", "content_type", "clip_id", "url", "embed_url", "video_url", "thumbnail_url", "title", "channel", "creator", "category", "created_at", "duration", "timestamp", "status", "submitted_at") SELECT "id", "platform", "content_type", "clip_id", "url", "embed_url", "video_url", "thumbnail_url", "title", "channel", "creator", "category", "created_at", "duration", "timestamp", "status", "submitted_at" FROM `clips`;--> statement-breakpoint
DROP TABLE `clips`;--> statement-breakpoint
ALTER TABLE `__new_clips` RENAME TO `clips`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_clips_platform` ON `clips` (`platform`);--> statement-breakpoint
CREATE INDEX `idx_clips_status` ON `clips` (`status`);--> statement-breakpoint
CREATE INDEX `idx_clips_channel` ON `clips` (`channel`);--> statement-breakpoint
CREATE INDEX `idx_clips_status_submitted` ON `clips` (`status`,`submitted_at`);