-- finnon v1 — Row Level Security (RLS)
-- Implements security policies to ensure users can only access data from accounts where they are members
-- Roles: viewer (read-only) | contributor (can create/edit transactions) | admin (full control)

-- =========================================================
-- HELPER FUNCTIONS
-- =========================================================

-- Check if current user is a member of a given account
CREATE OR REPLACE FUNCTION is_account_member(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM account_members
    WHERE account_id = p_account_id
      AND user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION is_account_member IS 'Returns true if current user is a member of the specified account';

-- Get the role of current user in a given account
CREATE OR REPLACE FUNCTION get_account_role(p_account_id uuid)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT role
  FROM account_members
  WHERE account_id = p_account_id
    AND user_id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_account_role IS 'Returns the role of current user in the specified account (viewer, contributor, admin)';

-- Check if current user has at least contributor role
CREATE OR REPLACE FUNCTION is_contributor_or_above(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM account_members
    WHERE account_id = p_account_id
      AND user_id = auth.uid()
      AND role IN ('contributor', 'admin')
  );
$$;

COMMENT ON FUNCTION is_contributor_or_above IS 'Returns true if current user is contributor or admin of the specified account';

-- Check if current user is admin of a given account
CREATE OR REPLACE FUNCTION is_account_admin(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM account_members
    WHERE account_id = p_account_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION is_account_admin IS 'Returns true if current user is admin of the specified account';

-- =========================================================
-- ENABLE ROW LEVEL SECURITY
-- =========================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners and superusers (important for testing)
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE account_members FORCE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE invites FORCE ROW LEVEL SECURITY;

-- subscriptions_catalog is a public directory (no RLS needed)
-- Users can read it without restrictions

-- =========================================================
-- POLICIES: ACCOUNTS
-- =========================================================

-- Users can view accounts where they are members
CREATE POLICY accounts_select_policy ON accounts
  FOR SELECT
  USING (is_account_member(id));

-- Users can create accounts (they become owner/admin automatically via trigger or application logic)
CREATE POLICY accounts_insert_policy ON accounts
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- Only account admins can update account details
CREATE POLICY accounts_update_policy ON accounts
  FOR UPDATE
  USING (is_account_admin(id))
  WITH CHECK (is_account_admin(id));

-- Only account admins can delete accounts
CREATE POLICY accounts_delete_policy ON accounts
  FOR DELETE
  USING (is_account_admin(id));

-- =========================================================
-- POLICIES: ACCOUNT_MEMBERS
-- =========================================================

-- Users can view members of accounts where they are members
CREATE POLICY account_members_select_policy ON account_members
  FOR SELECT
  USING (is_account_member(account_id));

-- Only admins can add members to accounts
CREATE POLICY account_members_insert_policy ON account_members
  FOR INSERT
  WITH CHECK (is_account_admin(account_id));

-- Only admins can update member roles
CREATE POLICY account_members_update_policy ON account_members
  FOR UPDATE
  USING (is_account_admin(account_id))
  WITH CHECK (is_account_admin(account_id));

-- Only admins can remove members
CREATE POLICY account_members_delete_policy ON account_members
  FOR DELETE
  USING (is_account_admin(account_id));

-- =========================================================
-- POLICIES: CATEGORIES
-- =========================================================

-- Users can view categories of accounts where they are members
CREATE POLICY categories_select_policy ON categories
  FOR SELECT
  USING (is_account_member(account_id));

-- Contributors and admins can create categories
CREATE POLICY categories_insert_policy ON categories
  FOR INSERT
  WITH CHECK (is_contributor_or_above(account_id));

-- Contributors and admins can update categories
CREATE POLICY categories_update_policy ON categories
  FOR UPDATE
  USING (is_contributor_or_above(account_id))
  WITH CHECK (is_contributor_or_above(account_id));

-- Contributors and admins can delete categories
CREATE POLICY categories_delete_policy ON categories
  FOR DELETE
  USING (is_contributor_or_above(account_id));

-- =========================================================
-- POLICIES: TRANSACTIONS
-- =========================================================

-- Users can view transactions of accounts where they are members
CREATE POLICY transactions_select_policy ON transactions
  FOR SELECT
  USING (is_account_member(account_id));

-- Contributors and admins can create transactions
CREATE POLICY transactions_insert_policy ON transactions
  FOR INSERT
  WITH CHECK (
    is_contributor_or_above(account_id)
    AND created_by = auth.uid()
  );

-- Contributors and admins can update transactions
-- v1 simplification: allow updating any transaction in the account (not just own)
CREATE POLICY transactions_update_policy ON transactions
  FOR UPDATE
  USING (is_contributor_or_above(account_id))
  WITH CHECK (is_contributor_or_above(account_id));

-- Contributors and admins can delete transactions
-- v1 simplification: allow deleting any transaction in the account
CREATE POLICY transactions_delete_policy ON transactions
  FOR DELETE
  USING (is_contributor_or_above(account_id));

-- =========================================================
-- POLICIES: ATTACHMENTS
-- =========================================================

-- Users can view attachments of accounts where they are members
CREATE POLICY attachments_select_policy ON attachments
  FOR SELECT
  USING (is_account_member(account_id));

-- Contributors and admins can create attachments
CREATE POLICY attachments_insert_policy ON attachments
  FOR INSERT
  WITH CHECK (is_contributor_or_above(account_id));

-- Contributors and admins can update attachments
CREATE POLICY attachments_update_policy ON attachments
  FOR UPDATE
  USING (is_contributor_or_above(account_id))
  WITH CHECK (is_contributor_or_above(account_id));

-- Contributors and admins can delete attachments
CREATE POLICY attachments_delete_policy ON attachments
  FOR DELETE
  USING (is_contributor_or_above(account_id));

-- =========================================================
-- POLICIES: INVITES
-- =========================================================

-- Members can view invites of accounts where they are members
CREATE POLICY invites_select_policy ON invites
  FOR SELECT
  USING (is_account_member(account_id));

-- Only admins can create invites
CREATE POLICY invites_insert_policy ON invites
  FOR INSERT
  WITH CHECK (
    is_account_admin(account_id)
    AND created_by = auth.uid()
  );

-- Only admins can update invites (e.g., to revoke them)
CREATE POLICY invites_update_policy ON invites
  FOR UPDATE
  USING (is_account_admin(account_id))
  WITH CHECK (is_account_admin(account_id));

-- Only admins can delete invites
CREATE POLICY invites_delete_policy ON invites
  FOR DELETE
  USING (is_account_admin(account_id));

-- =========================================================
-- SUBSCRIPTIONS_CATALOG - PUBLIC ACCESS
-- =========================================================

-- Allow all authenticated users to read the subscriptions catalog
CREATE POLICY subscriptions_catalog_select_policy ON subscriptions_catalog
  FOR SELECT
  USING (true);

-- Only service role can modify the catalog (not regular users)
-- No INSERT/UPDATE/DELETE policies = only service role can modify

-- =========================================================
-- ADDITIONAL SECURITY: STORAGE POLICIES (for attachments bucket)
-- =========================================================
-- Note: Storage bucket policies should be configured separately in Supabase dashboard or via SQL:
-- Bucket: 'attachments'
-- Path structure: {account_id}/{transaction_id}/{filename}
-- Policy: Users can only upload/download files from accounts where they are members
--
-- Example storage policy (to be applied separately):
-- SELECT: bucket_id = 'attachments' AND (storage.foldername(name))[1] IN (
--   SELECT account_id::text FROM account_members WHERE user_id = auth.uid()
-- )
