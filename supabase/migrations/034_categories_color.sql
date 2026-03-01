-- finnon — category color palette support
-- Adds color field for category customization and home weekly stacks.

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS color varchar(7) DEFAULT NULL;

COMMENT ON COLUMN categories.color IS
  'Hex color (#RRGGBB) used in category UI and calendar visualizations.';
