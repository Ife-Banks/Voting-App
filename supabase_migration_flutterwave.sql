-- ============================================================
-- FLUTTERWAVE MIGRATION — Run in Supabase SQL Editor
-- Renames paystack_reference → tx_ref, adds flw_transaction_id
-- Safe to run on existing data (no data loss)
-- ============================================================

ALTER TABLE payments RENAME COLUMN paystack_reference TO tx_ref;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS flw_transaction_id BIGINT;
