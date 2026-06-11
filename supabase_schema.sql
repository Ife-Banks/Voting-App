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

------------------------------------------------------
-- 3. ENABLE ROW LEVEL SECURITY
------------------------------------------------------
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

------------------------------------------------------
-- 4. DROP OLD POLICIES (safe re-run)
------------------------------------------------------
DROP POLICY IF EXISTS "sessions_read" ON voting_sessions;
DROP POLICY IF EXISTS "sessions_admin_insert" ON voting_sessions;
DROP POLICY IF EXISTS "sessions_admin_update" ON voting_sessions;
DROP POLICY IF EXISTS "sessions_admin_delete" ON voting_sessions;
DROP POLICY IF EXISTS "settings_read" ON settings;
DROP POLICY IF EXISTS "settings_admin_update" ON settings;
DROP POLICY IF EXISTS "positions_read" ON positions;
DROP POLICY IF EXISTS "positions_admin_insert" ON positions;
DROP POLICY IF EXISTS "positions_admin_update" ON positions;
DROP POLICY IF EXISTS "positions_admin_delete" ON positions;
DROP POLICY IF EXISTS "candidates_read" ON candidates;
DROP POLICY IF EXISTS "candidates_admin_insert" ON candidates;
DROP POLICY IF EXISTS "candidates_admin_update" ON candidates;
DROP POLICY IF EXISTS "candidates_admin_delete" ON candidates;
DROP POLICY IF EXISTS "students_read" ON students;
DROP POLICY IF EXISTS "students_admin_insert" ON students;
DROP POLICY IF EXISTS "students_admin_update" ON students;
DROP POLICY IF EXISTS "students_admin_delete" ON students;
DROP POLICY IF EXISTS "votes_service" ON votes;
DROP POLICY IF EXISTS "votes_admin_read" ON votes;

------------------------------------------------------
-- 5. CREATE RLS POLICIES
-- Replace 'ifeoluwa.bankole@tech-u.edu.ng' with YOUR admin email
------------------------------------------------------
-- Voting sessions
CREATE POLICY "sessions_read" ON voting_sessions FOR SELECT USING (TRUE);
CREATE POLICY "sessions_admin_insert" ON voting_sessions FOR INSERT
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "sessions_admin_update" ON voting_sessions FOR UPDATE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "sessions_admin_delete" ON voting_sessions FOR DELETE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- Settings
CREATE POLICY "settings_read" ON settings FOR SELECT USING (TRUE);
CREATE POLICY "settings_admin_update" ON settings FOR UPDATE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- Positions
CREATE POLICY "positions_read" ON positions FOR SELECT USING (TRUE);
CREATE POLICY "positions_admin_insert" ON positions FOR INSERT
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "positions_admin_update" ON positions FOR UPDATE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "positions_admin_delete" ON positions FOR DELETE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- Candidates
CREATE POLICY "candidates_read" ON candidates FOR SELECT USING (TRUE);
CREATE POLICY "candidates_admin_insert" ON candidates FOR INSERT
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "candidates_admin_update" ON candidates FOR UPDATE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "candidates_admin_delete" ON candidates FOR DELETE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- Students
CREATE POLICY "students_read" ON students FOR SELECT USING (TRUE);
CREATE POLICY "students_admin_insert" ON students FOR INSERT
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "students_admin_update" ON students FOR UPDATE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "students_admin_delete" ON students FOR DELETE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- Votes
CREATE POLICY "votes_admin_read" ON votes FOR SELECT
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

------------------------------------------------------
-- 6. ADMIN PROFILES
------------------------------------------------------
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

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_profiles_select" ON admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_insert" ON admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_delete" ON admin_profiles;

CREATE POLICY "admin_profiles_select" ON admin_profiles FOR SELECT
  USING (auth.email() = email OR
         auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

CREATE POLICY "admin_profiles_insert" ON admin_profiles FOR INSERT
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

CREATE POLICY "admin_profiles_delete" ON admin_profiles FOR DELETE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

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
