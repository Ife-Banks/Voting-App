-- ============================================================
-- NASSA STUDENT CHOICE AWARD — FULL SETUP
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

------------------------------------------------------
-- 1. CREATE TABLES
------------------------------------------------------
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  bio TEXT,
  vote_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (position_id, full_name)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  voter_name TEXT NOT NULL,
  voter_email TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  price_per_vote_kobo INT NOT NULL,
  amount_kobo INT NOT NULL,
  paystack_reference TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  award_open BOOLEAN DEFAULT TRUE,
  price_per_vote_kobo INT DEFAULT 10000,
  award_name TEXT DEFAULT 'NASSA Student Choice Award',
  school_name TEXT DEFAULT 'Abiola Ajimobi Technical University',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

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
-- 2. DROP ALL EXISTING POLICIES (safe re-run)
------------------------------------------------------
DO $$ DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('positions','candidates','payments','settings','admin_profiles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "candidates_select" ON storage.objects;
DROP POLICY IF EXISTS "candidates_upload" ON storage.objects;
DROP POLICY IF EXISTS "candidates_update" ON storage.objects;

------------------------------------------------------
-- 3. ENABLE ROW LEVEL SECURITY
------------------------------------------------------
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

------------------------------------------------------
-- 4. RLS POLICIES
-- Replace 'ifeoluwa.bankole@tech-u.edu.ng' with your admin email
------------------------------------------------------

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

-- PAYMENTS — no public read, only service-role access
-- (payments contains names and emails, never readable by anon key)

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
-- 5. SERVICE ROLE PERMISSIONS
------------------------------------------------------
GRANT INSERT, UPDATE, DELETE ON positions TO service_role;
GRANT INSERT, UPDATE, DELETE ON candidates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO service_role;
GRANT UPDATE ON settings TO service_role;
GRANT INSERT, UPDATE, DELETE ON admin_profiles TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

------------------------------------------------------
-- 6. ADMIN PROFILES (seed)
------------------------------------------------------
INSERT INTO admin_profiles (email, name, role, permissions)
VALUES ('ifeoluwa.bankole@tech-u.edu.ng', 'Super Admin', 'super_admin',
  '{"view_results": true, "view_positions": true}')
ON CONFLICT (email) DO NOTHING;

------------------------------------------------------
-- 7. VOTE FUNCTION (atomic increment with quantity)
------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_candidate_votes(p_candidate_id UUID, p_quantity INT)
RETURNS VOID AS $$
BEGIN
  UPDATE candidates SET vote_count = vote_count + p_quantity WHERE id = p_candidate_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------
-- 8. BULK UPSERT CANDIDATES
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
    INSERT INTO candidates (position_id, full_name, bio)
    VALUES (
      (item->>'position_id')::uuid,
      item->>'full_name',
      NULLIF(item->>'bio', '')::text
    )
    ON CONFLICT (position_id, full_name) DO UPDATE SET
      bio = NULLIF(item->>'bio', '')::text;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
