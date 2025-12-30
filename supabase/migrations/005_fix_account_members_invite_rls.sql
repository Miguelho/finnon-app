-- Fix RLS policy for account_members to allow invite acceptance
-- 
-- Problem: The account_members INSERT policy only allows:
-- 1. Existing admins to add members
-- 2. Account owners to self-register as admin
-- 
-- Missing: Users accepting valid invites (including anonymous users)
--
-- Solution: Add a third case that checks if there's a valid invite for the user
-- being added to the account with the role specified in the invite.

-- Drop existing policy
DROP POLICY IF EXISTS account_members_insert_policy ON account_members;

-- Create new policy with invite acceptance support
CREATE POLICY account_members_insert_policy ON account_members
  FOR INSERT
  WITH CHECK (
    -- Case 1: Existing admin adding members (normal flow)
    EXISTS (
      SELECT 1 FROM account_members am
      WHERE am.account_id = account_members.account_id
      AND am.user_id = (select auth.uid())
      AND am.role = 'admin'
    )
    OR
    -- Case 2: Owner self-registering as admin (initial setup via trigger or manual)
    (
      account_members.user_id = (select auth.uid())
      AND account_members.role = 'admin'
      AND EXISTS (
        SELECT 1 FROM accounts a
        WHERE a.id = account_members.account_id
        AND a.owner_user_id = (select auth.uid())
      )
    )
    OR
    -- Case 3: User accepting a valid invite (NEW - enables anonymous invite acceptance)
    -- This allows the /api/invites/accept endpoint to add users via valid invite tokens
    (
      account_members.user_id = (select auth.uid())
      AND EXISTS (
        SELECT 1 FROM invites inv
        WHERE inv.account_id = account_members.account_id
        AND inv.role = account_members.role  -- Role must match invite
        AND inv.revoked_at IS NULL           -- Not revoked
        AND inv.expires_at > now()           -- Not expired
        AND (
          inv.max_uses IS NULL                -- Unlimited uses
          OR inv.uses_count < inv.max_uses    -- Or within limit
        )
      )
    )
  );

COMMENT ON POLICY account_members_insert_policy ON account_members IS 
  'Allows: (1) admins to add members, (2) owners to self-register, (3) users to accept valid invites';

