-- finnon — Profiles table synced with auth.users
-- Creates public.profiles with triggers to sync from auth.users

-- =========================================================
-- 1. PROFILES TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_url text,
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE profiles IS 'User profiles synced from auth.users';
COMMENT ON COLUMN profiles.user_id IS 'References auth.users(id)';
COMMENT ON COLUMN profiles.display_name IS 'Computed from user metadata (full_name, display_name, etc.)';

-- Index for email lookups (used in invite flow)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- =========================================================
-- 2. RLS POLICIES
-- =========================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

-- SELECT: Any authenticated user can view profiles (needed to see account members)
CREATE POLICY profiles_select_policy ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- UPDATE: Only the user can update their own profile
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =========================================================
-- 3. TRIGGER: Auto-create profile on signup
-- =========================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'name',
      NULLIF(CONCAT_WS(' ',
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name'
      ), '')
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =========================================================
-- 4. TRIGGER: Sync changes from auth.users to profiles
-- =========================================================
CREATE OR REPLACE FUNCTION handle_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET
    email = NEW.email,
    display_name = COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'name',
      NULLIF(CONCAT_WS(' ',
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name'
      ), '')
    ),
    updated_at = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_user_update();

-- =========================================================
-- 5. SEED: Populate profiles for existing users
-- =========================================================
INSERT INTO profiles (user_id, email, display_name)
SELECT
  id,
  email,
  COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'display_name',
    raw_user_meta_data->>'name',
    NULLIF(CONCAT_WS(' ',
      raw_user_meta_data->>'first_name',
      raw_user_meta_data->>'last_name'
    ), '')
  )
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
