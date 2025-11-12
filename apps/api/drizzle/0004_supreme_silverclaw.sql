/**
 * Migration: Add timestamp field for video start time
 * Date: 2025-10-14
 *
 * Adds timestamp column to clips table to support URL timestamp parameters
 * (e.g., ?t=0h12m0s on Twitch VODs). Allows videos to start at specific times.
 */
ALTER TABLE `clips` ADD `timestamp` integer;