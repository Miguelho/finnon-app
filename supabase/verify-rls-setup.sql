-- finnon v1 — Verify RLS Setup
-- Checks that RLS is correctly configured (doesn't test enforcement due to BYPASSRLS)

\echo ''
\echo '=================================================='
\echo 'FINNON RLS SETUP VERIFICATION'
\echo '=================================================='
\echo ''

-- Check 1: RLS is enabled on all tables
\echo '--- RLS Status ---'
SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✓ Enabled' ELSE '✗ Disabled' END as rls,
  CASE WHEN relforcerowsecurity THEN '✓ Forced' ELSE '✗ Not Forced' END as force_rls
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.schemaname)
WHERE schemaname = 'public'
  AND tablename IN ('accounts', 'account_members', 'categories', 'transactions', 'attachments', 'invites')
ORDER BY tablename;

\echo ''
\echo '--- Policies Count ---'
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

\echo ''
\echo '--- Helper Functions ---'
SELECT
  proname as function_name,
  CASE WHEN prosecdef THEN 'DEFINER' ELSE 'INVOKER' END as security,
  CASE WHEN provolatile = 'i' THEN 'IMMUTABLE'
       WHEN provolatile = 's' THEN 'STABLE'
       ELSE 'VOLATILE' END as volatility
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname IN ('is_account_member', 'is_contributor_or_above', 'is_account_admin', 'get_account_role')
ORDER BY proname;

\echo ''
\echo '--- Test Data ---'
SELECT 'Accounts:' as category, COUNT(*) as count FROM accounts
UNION ALL
SELECT 'Members:', COUNT(*) FROM account_members
UNION ALL
SELECT 'Categories:', COUNT(*) FROM categories
UNION ALL
SELECT 'Transactions:', COUNT(*) FROM transactions
UNION ALL
SELECT 'Invites:', COUNT(*) FROM invites;

\echo ''
\echo '=================================================='
\echo 'VERIFICATION COMPLETE'
\echo '=================================================='
\echo ''
\echo 'Next steps:'
\echo '  1. All tables should have RLS enabled and forced'
\echo '  2. Each table should have 4 policies (SELECT/INSERT/UPDATE/DELETE)'
\echo '  3. Helper functions should exist with INVOKER security'
\echo '  4. Test data should be present'
\echo ''
\echo 'Note: Actual RLS enforcement will work in production with real'
\echo '      Supabase Auth users. The postgres user bypasses RLS locally.'
\echo '=================================================='
\echo ''
