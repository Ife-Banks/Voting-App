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
  election_name TEXT DEFAULT 'SRC Elections',
  school_name TEXT DEFAULT 'Our School',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (id, voting_open, election_name, school_name)
VALUES (1, FALSE, 'SRC Elections 2025/2026', 'Abiola Ajimobi Technical University')
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

-- STUDENTS — admin only, public blocked
CREATE POLICY "students_admin_access" ON students
  FOR ALL USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng')
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- POSITIONS — public read, admin write
CREATE POLICY "positions_public_read" ON positions FOR SELECT USING (true);
CREATE POLICY "positions_admin_write" ON positions
  FOR ALL USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng')
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- CANDIDATES — public read, admin write
CREATE POLICY "candidates_public_read" ON candidates FOR SELECT USING (true);
CREATE POLICY "candidates_admin_write" ON candidates
  FOR ALL USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng')
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- VOTES — public locked, admin read
CREATE POLICY "votes_admin_read" ON votes FOR SELECT
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- VOTING_SESSIONS — admin only
CREATE POLICY "voting_sessions_admin_access" ON voting_sessions
  FOR ALL USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng')
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- SETTINGS — public read, admin update
CREATE POLICY "settings_public_read" ON settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_update" ON settings FOR UPDATE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- ADMIN_PROFILES — admin reads own + super admin full
CREATE POLICY "admin_profiles_read" ON admin_profiles FOR SELECT
  USING (auth.email() = email OR auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "admin_profiles_write" ON admin_profiles
  FOR ALL USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng')
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

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
-- 6. ADMIN PROFILES (seed)
------------------------------------------------------
INSERT INTO admin_profiles (email, name, role, permissions)
VALUES ('ifeoluwa.bankole@tech-u.edu.ng', 'Super Admin', 'super_admin',
  '{"view_results": true, "view_positions": true}')
ON CONFLICT (email) DO NOTHING;

------------------------------------------------------
-- 7. VOTE FUNCTION
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
-- 7. ADMIN SETUP (in Supabase Auth)
------------------------------------------------------
-- Go to Authentication > Users > Invite user
-- Use: ifeoluwa.bankole@tech-u.edu.ng
