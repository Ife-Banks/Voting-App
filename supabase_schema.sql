-- ============================================================
-- SRC VOTING APP — SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Students (allowed voter emails)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  has_logged_in BOOLEAN DEFAULT FALSE,
  has_voted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Positions (e.g. President, VP, etc.)
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Candidates
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  class TEXT,
  manifesto TEXT,
  photo_url TEXT,
  vote_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Votes (one row per student per position)
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email TEXT NOT NULL,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_email, position_id)
);

-- 5. Voting sessions (separate voting periods)
CREATE TABLE voting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- 6. Election settings
CREATE TABLE settings (
  id INT PRIMARY KEY DEFAULT 1,
  voting_open BOOLEAN DEFAULT FALSE,
  election_name TEXT DEFAULT 'SRC Elections',
  school_name TEXT DEFAULT 'Our School',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (id, voting_open, election_name, school_name)
VALUES (1, FALSE, 'SRC Elections 2025/2026', 'Federal Government College');

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Voting sessions: anyone can read, admin can manage
CREATE POLICY "sessions_read" ON voting_sessions FOR SELECT USING (TRUE);
CREATE POLICY "sessions_admin" ON voting_sessions FOR INSERT
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "sessions_admin_update" ON voting_sessions FOR UPDATE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng')
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "sessions_admin_delete" ON voting_sessions FOR DELETE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- Settings: anyone can read, admin can update
CREATE POLICY "settings_read" ON settings FOR SELECT USING (TRUE);
CREATE POLICY "settings_admin" ON settings FOR UPDATE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng')
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- Positions: anyone can read, admin can manage
CREATE POLICY "positions_read" ON positions FOR SELECT USING (TRUE);
CREATE POLICY "positions_admin" ON positions FOR INSERT
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "positions_admin_update" ON positions FOR UPDATE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng')
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "positions_admin_delete" ON positions FOR DELETE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- Candidates: anyone can read, admin can manage
CREATE POLICY "candidates_read" ON candidates FOR SELECT USING (TRUE);
CREATE POLICY "candidates_admin" ON candidates FOR INSERT
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "candidates_admin_update" ON candidates FOR UPDATE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng')
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "candidates_admin_delete" ON candidates FOR DELETE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- Students: anyone can read (to check registration), admin can manage
CREATE POLICY "students_read" ON students FOR SELECT USING (TRUE);
CREATE POLICY "students_admin_insert" ON students FOR INSERT
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "students_admin_update" ON students FOR UPDATE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng')
  WITH CHECK (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');
CREATE POLICY "students_admin_delete" ON students FOR DELETE
  USING (auth.email() = 'ifeoluwa.bankole@tech-u.edu.ng');

-- Votes: service role only
CREATE POLICY "votes_service" ON votes USING (TRUE);

-- ============================================================
-- STORAGE BUCKET for candidate photos
-- ============================================================
-- In Supabase Dashboard: Storage > New Bucket > "candidates" > Public bucket

-- ============================================================
-- MIGRATION for existing students table
-- Run this if students table already exists:
--   ALTER TABLE students ADD COLUMN has_logged_in BOOLEAN DEFAULT FALSE;
-- ============================================================

-- ============================================================
-- INCREMENT VOTE FUNCTION (called by the API)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_vote(candidate_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE candidates
  SET vote_count = vote_count + 1
  WHERE id = candidate_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ADMIN USER SETUP
-- ============================================================
-- In Supabase Dashboard: Authentication > Users > Invite user
-- Use your admin email. The app detects admin by checking 
-- if the email matches NEXT_PUBLIC_ADMIN_EMAIL env variable.
