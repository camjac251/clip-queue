/**
 * Migration: Add composite index for status + submittedAt queries
 * Date: 2025-10-08
 *
 * Adds composite index (status, submittedAt) to optimize queries that
 * filter by status and order by submittedAt. Prevents full table scans
 * when loading approved/played clips.
 */
CREATE INDEX `idx_clips_status_submitted` ON `clips` (`status`,`submitted_at`);