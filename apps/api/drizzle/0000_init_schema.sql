/**
 * Migration: Initial Schema
 * Date: 2025-10-07
 *
 * Creates normalized database structure with:
 * - clips: Main clip storage with 14 columns
 * - clip_submitters: Many-to-many relationship for submitters
 * - settings: Global app settings with version tracking
 *
 * Indices:
 * - clips: provider, status, channel, played_at
 * - clip_submitters: clip_id, unique(clip_id + submitter)
 */

CREATE TABLE `clip_submitters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clip_id` text NOT NULL,
	`submitter` text NOT NULL,
	`submitted_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`clip_id`) REFERENCES `clips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_submitters_clip_id` ON `clip_submitters` (`clip_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_clip_submitter` ON `clip_submitters` (`clip_id`,`submitter`);--> statement-breakpoint
CREATE TABLE `clips` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`clip_id` text NOT NULL,
	`url` text NOT NULL,
	`embed_url` text NOT NULL,
	`thumbnail_url` text NOT NULL,
	`title` text NOT NULL,
	`channel` text NOT NULL,
	`creator` text NOT NULL,
	`category` text,
	`created_at` text,
	`status` text DEFAULT 'approved' NOT NULL,
	`submitted_at` integer DEFAULT (unixepoch()) NOT NULL,
	`played_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_clips_provider` ON `clips` (`provider`);--> statement-breakpoint
CREATE INDEX `idx_clips_status` ON `clips` (`status`);--> statement-breakpoint
CREATE INDEX `idx_clips_channel` ON `clips` (`channel`);--> statement-breakpoint
CREATE INDEX `idx_clips_played_at` ON `clips` (`played_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`commands` text NOT NULL,
	`queue` text NOT NULL,
	`logger` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
