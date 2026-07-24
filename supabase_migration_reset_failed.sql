-- Reset all 'failed' payments back to 'pending' so the reconciliation cron
-- can re-check them with the new 7-day bank transfer settlement window.
-- Run this in the Supabase SQL Editor, then hit "Re-verify pending" in the admin dashboard.

UPDATE payments
SET status = 'pending', verified_at = NULL
WHERE status = 'failed';
