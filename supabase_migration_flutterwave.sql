-- ============================================================
-- FLUTTERWAVE MIGRATION — Run in Supabase SQL Editor
-- Renames paystack_reference → tx_ref, adds flw_transaction_id
-- Fixes missing SELECT permission on payments for service_role
-- Safe to run on existing data (no data loss)
-- ============================================================

ALTER TABLE payments RENAME COLUMN paystack_reference TO tx_ref;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS flw_transaction_id BIGINT;

-- Fix: service_role needs SELECT on payments to verify transactions
GRANT SELECT ON payments TO service_role;

-- Add results visibility toggle
ALTER TABLE settings ADD COLUMN IF NOT EXISTS results_visible BOOLEAN DEFAULT FALSE;
