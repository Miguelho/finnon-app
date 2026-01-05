-- Add invite targets for registered users
ALTER TABLE invites
  ADD COLUMN IF NOT EXISTS invitee_user_id uuid,
  ADD COLUMN IF NOT EXISTS invitee_email text;

COMMENT ON COLUMN invites.invitee_user_id IS 'Target user id for registered user invites';
COMMENT ON COLUMN invites.invitee_email IS 'Target email for registered user invites';

CREATE INDEX IF NOT EXISTS idx_invites_invitee_user_id ON invites(invitee_user_id);
CREATE INDEX IF NOT EXISTS idx_invites_invitee_email ON invites(invitee_email);
