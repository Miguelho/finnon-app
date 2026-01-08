-- finnon — Avatar fallback customization

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'avatar_fallback_text'
  ) THEN
    ALTER TABLE profiles ADD COLUMN avatar_fallback_text text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'avatar_fallback_bg_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN avatar_fallback_bg_token text;
  END IF;
END $$;

