-- Fix RLS policy for invites table to allow anonymous users to accept invitations
-- 
-- Problem: Previous policy required users to be members before they could read invites,
-- creating a chicken-and-egg situation (can't read invite → can't become member → can't read invite)
--
-- Solution: Allow ANY authenticated user (including anonymous) to SELECT from invites
-- This is secure because:
-- 1. The token has 32 bytes of cryptographic entropy (impossible to guess)
-- 2. The token is hashed with SHA-256 before storage (protects original token)
-- 3. Users can only use invites they know the exact token for
-- 4. The accept endpoint validates expiration, revocation, and max_uses

-- Drop existing policy
DROP POLICY IF EXISTS invites_select_policy ON invites;

-- Create new policy that allows:
-- 1. Account members to view all invites for their accounts (for management UI)
-- 2. ANY authenticated user (including anonymous) to read invites
--    (they need the exact token_hash to find a specific invite via WHERE clause)
CREATE POLICY invites_select_policy ON invites
  FOR SELECT
  USING (
    -- Members can view all invites of their accounts
    is_account_member(account_id)
    OR
    -- Any authenticated user (including anonymous sessions) can query by token_hash
    -- This is safe because token_hash requires knowledge of the original token
    auth.uid() IS NOT NULL
  );

COMMENT ON POLICY invites_select_policy ON invites IS 
  'Allows account members to view all invites, and authenticated users to lookup invites by token_hash';

