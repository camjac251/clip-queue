/**
 * Migration: Add content type support (clips, VODs, highlights)
 * Date: 2025-10-14
 *
 * Adds support for different content types from the same platform:
 * - content_type: 'clip' (default), 'vod', 'highlight'
 * - duration: Duration in seconds (for VODs and highlights)
 *
 * Existing clips are automatically set to content_type='clip'
 */
ALTER TABLE `clips` ADD `content_type` text DEFAULT 'clip' NOT NULL;--> statement-breakpoint
ALTER TABLE `clips` ADD `duration` integer;