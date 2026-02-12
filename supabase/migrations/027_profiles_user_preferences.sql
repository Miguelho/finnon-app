-- finnon — User profile preferences

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_color text DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS theme text DEFAULT 'grafito',
  ADD COLUMN IF NOT EXISTS color_mode text DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS locale text DEFAULT 'es';

UPDATE profiles
SET
  avatar_color = COALESCE(avatar_color, 'blue'),
  theme = COALESCE(theme, 'grafito'),
  color_mode = COALESCE(color_mode, 'system'),
  locale = COALESCE(locale, 'es');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_avatar_color_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_avatar_color_check
      CHECK (avatar_color IN ('blue', 'green', 'coral', 'purple', 'amber', 'slate'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_theme_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_theme_check
      CHECK (theme IN ('grafito', 'oceano'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_color_mode_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_color_mode_check
      CHECK (color_mode IN ('light', 'dark', 'system'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_locale_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_locale_check
      CHECK (locale IN ('es', 'en'));
  END IF;
END $$;
