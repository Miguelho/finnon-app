-- Allow in-app invites to omit token_hash (no link-based invite)

ALTER TABLE invites
  ALTER COLUMN token_hash DROP NOT NULL;
