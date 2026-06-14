-- ============================================================
-- SRC VOTING APP — FULL SETUP
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

------------------------------------------------------
-- 1. CLEAN UP OLD COLUMNS
------------------------------------------------------
ALTER TABLE students DROP COLUMN IF EXISTS has_logged_in;
ALTER TABLE students DROP COLUMN IF EXISTS otp_code;
ALTER TABLE students DROP COLUMN IF EXISTS otp_expires_at;
ALTER TABLE students DROP COLUMN IF EXISTS otp_attempts;
ALTER TABLE students DROP COLUMN IF EXISTS otp_created_at;

-- Ensure email has UNIQUE constraint (needed for upsert on_conflict)
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_email_key CASCADE;
ALTER TABLE students ADD CONSTRAINT students_email_key UNIQUE (email);

-- Add results_public column to existing settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS results_public BOOLEAN DEFAULT FALSE;

------------------------------------------------------
-- 2. CREATE TABLES (safe to re-run)
------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  has_voted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  class TEXT,
  manifesto TEXT,
  photo_url TEXT,
  vote_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email TEXT NOT NULL,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_email, position_id)
);

CREATE TABLE IF NOT EXISTS voting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  voting_open BOOLEAN DEFAULT FALSE,
  results_public BOOLEAN DEFAULT FALSE,
  election_name TEXT DEFAULT 'SRC Elections',
  school_name TEXT DEFAULT 'Our School',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (id, voting_open, results_public, election_name, school_name)
VALUES (1, FALSE, FALSE, 'SRC Elections 2025/2026', 'Abiola Ajimobi Technical University')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  permissions JSONB DEFAULT '{"view_results": true, "view_positions": true}',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------
-- 3. DROP ALL EXISTING POLICIES (safe re-run)
------------------------------------------------------
DO $$ DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('students','positions','candidates','votes','voting_sessions','settings','admin_profiles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "candidates_select" ON storage.objects;
DROP POLICY IF EXISTS "candidates_upload" ON storage.objects;
DROP POLICY IF EXISTS "candidates_update" ON storage.objects;

------------------------------------------------------
-- 4. ENABLE ROW LEVEL SECURITY
------------------------------------------------------
ALTER TABLE IF EXISTS students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS voting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_profiles ENABLE ROW LEVEL SECURITY;

------------------------------------------------------
-- 5. RLS POLICIES
-- Replace 'ifeoluwa.bankole@tech-u.edu.ng' with your admin email
------------------------------------------------------

-- STUDENTS — admin only (via admin_profiles), public blocked
CREATE POLICY "students_admin_read" ON students FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE email = auth.email()));
CREATE POLICY "students_admin_write" ON students FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE email = auth.email()));
CREATE POLICY "students_admin_update" ON students FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE email = auth.email()));
CREATE POLICY "students_admin_delete" ON students FOR DELETE
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE email = auth.email()));

-- POSITIONS — public read, admin write
CREATE POLICY "positions_public_read" ON positions FOR SELECT USING (true);
CREATE POLICY "positions_admin_insert" ON positions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE email = auth.email()));
CREATE POLICY "positions_admin_update" ON positions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE email = auth.email()));
CREATE POLICY "positions_admin_delete" ON positions FOR DELETE
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE email = auth.email()));

-- CANDIDATES — public read only, no updates/deletes after creation
CREATE POLICY "candidates_public_read" ON candidates FOR SELECT USING (true);

-- VOTES — admin read only, no inserts/updates/deletes after voting
CREATE POLICY "votes_admin_read" ON votes FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE email = auth.email()));

-- VOTING_SESSIONS — admin only
CREATE POLICY "voting_sessions_admin_read" ON voting_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE email = auth.email()));
CREATE POLICY "voting_sessions_admin_insert" ON voting_sessions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE email = auth.email()));
CREATE POLICY "voting_sessions_admin_update" ON voting_sessions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE email = auth.email()));
CREATE POLICY "voting_sessions_admin_delete" ON voting_sessions FOR DELETE
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE email = auth.email()));

-- SETTINGS — public read, admin update
CREATE POLICY "settings_public_read" ON settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_update" ON settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE email = auth.email()));

-- ADMIN_PROFILES — own-row read, super admin full access (no self-referencing subquery)
CREATE POLICY "admin_profiles_read" ON admin_profiles FOR SELECT
  USING (auth.email() = email);
CREATE POLICY "admin_profiles_super_read" ON admin_profiles FOR SELECT
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "admin_profiles_insert" ON admin_profiles FOR INSERT
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "admin_profiles_update" ON admin_profiles FOR UPDATE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "admin_profiles_delete" ON admin_profiles FOR DELETE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- STORAGE — candidate photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidates', 'candidates', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "candidates_select" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'candidates');
CREATE POLICY "candidates_upload" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'candidates');
CREATE POLICY "candidates_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'candidates');

-- CLEANUP — remove old view if it exists
DROP VIEW IF EXISTS public_candidates CASCADE;

------------------------------------------------------
-- 6. IMMUTABLE VOTES — prevent any modification after voting
-- Create a restricted role for vote incrementing (least privilege)
------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE vote_counter WITH NOLOGIN PASSWORD 'vote-counter-role';
EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL;
END $$;

REVOKE ALL ON candidates FROM vote_counter;
GRANT SELECT ON candidates TO vote_counter;
GRANT UPDATE (vote_count) ON candidates TO vote_counter;

-- Block UPDATE/DELETE on votes and candidates for all application roles
-- INSERT on votes is still allowed for service_role (via /api/vote route)
REVOKE UPDATE, DELETE ON votes FROM service_role, authenticated, anon;
REVOKE UPDATE, DELETE ON candidates FROM service_role, authenticated, anon;

-- Explicitly ensure service_role can INSERT votes (for /api/vote during active voting)
GRANT INSERT ON votes TO service_role;

------------------------------------------------------
-- 7. ADMIN PROFILES (seed)
------------------------------------------------------
INSERT INTO admin_profiles (email, name, role, permissions)
VALUES ('ifeoluwa.bankole@tech-u.edu.ng', 'Super Admin', 'super_admin',
  '{"view_results": true, "view_positions": true}')
ON CONFLICT (email) DO NOTHING;

------------------------------------------------------
-- 8. VOTE FUNCTION
------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_vote(candidate_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE candidates
  SET vote_count = vote_count + 1
  WHERE id = candidate_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------
-- ADMIN SETUP (manual step)
------------------------------------------------------
-- Invite super admin in Supabase Dashboard > Authentication > Users > Invite user
-- Email: ifeoluwa.bankole@tech-u.edu.ng
