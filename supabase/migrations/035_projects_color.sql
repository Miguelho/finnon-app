-- finnon — projects color palette support
-- Adds color field for project palette assignment and customization.

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS color varchar(7) DEFAULT NULL;

COMMENT ON COLUMN projects.color IS
  'Hex color (#RRGGBB) used for project rings and labels. Null means auto-assigned on render.';
