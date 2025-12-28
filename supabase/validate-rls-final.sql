-- finnon v1 — RLS Validation (Final)
-- Temporarily removes BYPASSRLS from postgres to test RLS policies

-- Remove BYPASSRLS from postgres temporarily
ALTER ROLE postgres WITH NOBYPASSRLS;

-- Helper to set user context
CREATE OR REPLACE FUNCTION set_test_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id)::text, false);
END;
$$;

-- Run tests
DO $$
DECLARE
  alice_id uuid := '11111111-1111-1111-1111-111111111111';
  bob_id uuid := '22222222-2222-2222-2222-222222222222';
  charlie_id uuid := '33333333-3333-3333-3333-333333333333';
  david_id uuid := '44444444-4444-4444-4444-444444444444';

  account_a_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  account_b_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  test_pass boolean;
  test_count int := 0;
  pass_count int := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'FINNON RLS VALIDATION - CRITICAL SECURITY CHECKS';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '';

  -- Test 1: Alice can see Account A (she's admin)
  PERFORM set_test_user(alice_id);
  SELECT EXISTS(SELECT 1 FROM accounts WHERE id = account_a_id) INTO test_pass;
  test_count := test_count + 1;
  IF test_pass THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ [1/8] Alice can see Account A';
  ELSE
    RAISE NOTICE '✗ [1/8] FAIL: Alice cannot see Account A';
  END IF;

  -- Test 2: Alice CANNOT see Account B (not a member)
  PERFORM set_test_user(alice_id);
  SELECT NOT EXISTS(SELECT 1 FROM accounts WHERE id = account_b_id) INTO test_pass;
  test_count := test_count + 1;
  IF test_pass THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ [2/8] Alice cannot see Account B (correct)';
  ELSE
    RAISE NOTICE '✗ [2/8] SECURITY BREACH: Alice CAN see Account B!';
  END IF;

  -- Test 3: David (outsider) CANNOT see any accounts
  PERFORM set_test_user(david_id);
  SELECT COUNT(*) = 0 FROM accounts INTO test_pass;
  test_count := test_count + 1;
  IF test_pass THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ [3/8] David cannot see any accounts (correct)';
  ELSE
    RAISE NOTICE '✗ [3/8] SECURITY BREACH: David CAN see accounts!';
  END IF;

  -- Test 4: Bob can see transactions from Account A
  PERFORM set_test_user(bob_id);
  SELECT COUNT(*) > 0 FROM transactions WHERE account_id = account_a_id INTO test_pass;
  test_count := test_count + 1;
  IF test_pass THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ [4/8] Bob can see Account A transactions';
  ELSE
    RAISE NOTICE '✗ [4/8] FAIL: Bob cannot see Account A transactions';
  END IF;

  -- Test 5: Bob CANNOT see transactions from Account B
  PERFORM set_test_user(bob_id);
  SELECT COUNT(*) = 0 FROM transactions WHERE account_id = account_b_id INTO test_pass;
  test_count := test_count + 1;
  IF test_pass THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ [5/8] Bob cannot see Account B transactions (correct)';
  ELSE
    RAISE NOTICE '✗ [5/8] SECURITY BREACH: Bob CAN see Account B transactions!';
  END IF;

  -- Test 6: Charlie can see both accounts (member of both)
  PERFORM set_test_user(charlie_id);
  SELECT COUNT(*) = 2 FROM accounts WHERE id IN (account_a_id, account_b_id) INTO test_pass;
  test_count := test_count + 1;
  IF test_pass THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ [6/8] Charlie can see both accounts';
  ELSE
    RAISE NOTICE '✗ [6/8] FAIL: Charlie cannot see both accounts';
  END IF;

  -- Test 7: David CANNOT see any categories
  PERFORM set_test_user(david_id);
  SELECT COUNT(*) = 0 FROM categories INTO test_pass;
  test_count := test_count + 1;
  IF test_pass THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ [7/8] David cannot see any categories (correct)';
  ELSE
    RAISE NOTICE '✗ [7/8] SECURITY BREACH: David CAN see categories!';
  END IF;

  -- Test 8: Everyone can see subscriptions catalog (public)
  PERFORM set_test_user(david_id);
  SELECT COUNT(*) > 0 FROM subscriptions_catalog INTO test_pass;
  test_count := test_count + 1;
  IF test_pass THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ [8/8] Subscriptions catalog is public (correct)';
  ELSE
    RAISE NOTICE '✗ [8/8] FAIL: Cannot see public subscriptions catalog';
  END IF;

  -- Summary
  RAISE NOTICE '';
  RAISE NOTICE '==================================================';
  IF pass_count = test_count THEN
    RAISE NOTICE '✓ ALL TESTS PASSED (%/%)', pass_count, test_count;
    RAISE NOTICE '  RLS is working correctly!';
  ELSE
    RAISE NOTICE '✗ SOME TESTS FAILED (%/% passed)', pass_count, test_count;
    RAISE NOTICE '  Review RLS policies immediately!';
  END IF;
  RAISE NOTICE '==================================================';
  RAISE NOTICE '';
END $$;

-- Cleanup and restore BYPASSRLS
DROP FUNCTION IF EXISTS set_test_user(uuid);
ALTER ROLE postgres WITH BYPASSRLS;

RAISE NOTICE 'Note: BYPASSRLS restored for postgres user';
