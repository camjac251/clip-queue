/**
 * Migration: Add videoUrl field to clips table
 * Date: 2025-10-12
 *
 * Adds video_url column to store direct video URLs for Video.js playback
 * instead of using embed URLs (enables proper autoplay functionality).
 */
ALTER TABLE `clips` ADD `video_url` text;