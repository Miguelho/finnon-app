-- Invite v2: in-app invites with status + email targeting + optional code

ALTER TABLE invites
  ADD COLUMN IF NOT EXISTS invited_email text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS code_hash text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invites_status_check'
  ) THEN
    ALTER TABLE invites
      ADD CONSTRAINT invites_status_check
      CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked', 'expired'));
  END IF;
END $$;

-- Backfill invited_email from legacy invitee_email when available
UPDATE invites
SET invited_email = invitee_email
WHERE invited_email IS NULL
  AND invitee_email IS NOT NULL;

-- Backfill revoked status for legacy revoked invites
UPDATE invites
SET status = 'revoked'
WHERE revoked_at IS NOT NULL
  AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_invites_invited_email_status
  ON invites (lower(invited_email), status);

CREATE INDEX IF NOT EXISTS idx_invites_code_hash
  ON invites (code_hash);

-- Update RLS for invite inbox access
DROP POLICY IF EXISTS invites_select_policy ON invites;

CREATE POLICY invites_select_policy ON invites
  FOR SELECT
  USING (
    is_account_member(account_id)
    OR (
      invited_email IS NOT NULL
      AND lower(invited_email) = lower(auth.jwt() ->> 'email')
    )
    OR (
      invitee_email IS NOT NULL
      AND lower(invitee_email) = lower(auth.jwt() ->> 'email')
    )
    OR (invitee_user_id IS NOT NULL AND invitee_user_id = auth.uid())
  );

COMMENT ON POLICY invites_select_policy ON invites IS
  'Allows account members to view account invites and invitees to view their pending invites.';
