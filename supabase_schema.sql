-- ============================================================
-- NACOS VOTING APP — FULL SETUP (NACOS Branch)
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

------------------------------------------------------
-- 1. CREATE TABLES (must come first)
------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  matric_number TEXT UNIQUE,
  has_voted BOOLEAN DEFAULT FALSE,
  voted_from_ip TEXT,
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_attempts INT DEFAULT 0,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (position_id, full_name)
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
  otp_enabled BOOLEAN DEFAULT TRUE,
  election_name TEXT DEFAULT 'SRC Elections',
  school_name TEXT DEFAULT 'Our School',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient TEXT NOT NULL,
  purpose TEXT NOT NULL,
  provider TEXT,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

------------------------------------------------------
-- 2. ALTER EXISTING TABLES (safe to re-run)
------------------------------------------------------
ALTER TABLE settings ADD COLUMN IF NOT EXISTS results_public BOOLEAN DEFAULT FALSE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS otp_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS voted_from_ip TEXT;

INSERT INTO settings (id, voting_open, results_public, otp_enabled, election_name, school_name)
VALUES (1, FALSE, FALSE, TRUE, 'NACOS Executive Elections 2025/2026', 'Abiola Ajimobi Technical University')
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

-- CANDIDATES — public read only
CREATE POLICY "candidates_public_read" ON candidates FOR SELECT USING (true);

-- VOTES — admin read only
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

-- ADMIN_PROFILES — own-row read, super admin full access
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

------------------------------------------------------
-- 6. IMMUTABLE VOTES
------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE vote_counter WITH NOLOGIN PASSWORD 'vote-counter-role';
EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL;
END $$;

REVOKE ALL ON candidates FROM vote_counter;
GRANT SELECT ON candidates TO vote_counter;
GRANT UPDATE (vote_count) ON candidates TO vote_counter;

REVOKE UPDATE, DELETE ON votes FROM service_role, authenticated, anon;
REVOKE UPDATE, DELETE ON candidates FROM service_role, authenticated, anon;
GRANT INSERT ON votes TO service_role;
GRANT INSERT, UPDATE, DELETE ON candidates TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT INSERT, UPDATE, DELETE ON positions TO service_role;
GRANT INSERT, UPDATE, DELETE ON students TO service_role;
GRANT INSERT, UPDATE, DELETE ON voting_sessions TO service_role;
GRANT UPDATE ON settings TO service_role;

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
-- BULK UPSERT CANDIDATES (avoids UUID null issue)
------------------------------------------------------
CREATE OR REPLACE FUNCTION bulk_upsert_candidates(
  p_candidates JSONB
)
RETURNS void AS $$
DECLARE
  item JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_candidates)
  LOOP
    INSERT INTO candidates (position_id, full_name, class, manifesto)
    VALUES (
      (item->>'position_id')::uuid,
      item->>'full_name',
      NULLIF(item->>'class', '')::text,
      NULLIF(item->>'manifesto', '')::text
    )
    ON CONFLICT (position_id, full_name) DO UPDATE SET
      class = NULLIF(item->>'class', '')::text,
      manifesto = NULLIF(item->>'manifesto', '')::text;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;