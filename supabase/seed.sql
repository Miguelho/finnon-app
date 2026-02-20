-- finnon v1 — Seed data for testing RLS policies
-- Creates test users, accounts, and data to validate security policies

-- =========================================================
-- IMPORTANT: This seed is for LOCAL DEVELOPMENT ONLY
-- =========================================================
-- These test users with hardcoded UUIDs should NEVER be used in production
-- Use this to validate RLS policies in your local Supabase instance

-- =========================================================
-- 1. CREATE TEST USERS IN auth.users
-- =========================================================
-- Note: In local Supabase, we can insert directly into auth.users
-- In production, users are created via Supabase Auth API

-- Clear existing test data (in reverse order of dependencies)
TRUNCATE TABLE attachments CASCADE;
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE invites CASCADE;
TRUNCATE TABLE categories CASCADE;
TRUNCATE TABLE account_members CASCADE;
TRUNCATE TABLE accounts CASCADE;

-- Delete test users if they exist
DELETE FROM auth.users WHERE email LIKE '%@finnon-test.local';

-- Create test users
-- User 1: Alice (will be admin of Account A)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'alice@finnon-test.local',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Alice Admin"}',
  'authenticated',
  'authenticated'
);

-- User 2: Bob (will be contributor of Account A)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'bob@finnon-test.local',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Bob Contributor"}',
  'authenticated',
  'authenticated'
);

-- User 3: Charlie (will be viewer of Account A, admin of Account B)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'charlie@finnon-test.local',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Charlie Viewer"}',
  'authenticated',
  'authenticated'
);

-- User 4: David (not a member of any account - for testing access denial)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  'david@finnon-test.local',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"David Outsider"}',
  'authenticated',
  'authenticated'
);

-- =========================================================
-- 2. CREATE TEST ACCOUNTS
-- =========================================================

-- Account A: Alice's account (shared with Bob and Charlie)
INSERT INTO accounts (id, name, base_currency, owner_user_id, created_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Alice Family Budget',
  'EUR',
  '11111111-1111-1111-1111-111111111111',
  now()
);

-- Account B: Charlie's personal account
INSERT INTO accounts (id, name, base_currency, owner_user_id, created_at)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Charlie Personal',
  'USD',
  '33333333-3333-3333-3333-333333333333',
  now()
);

-- =========================================================
-- 3. CREATE ACCOUNT MEMBERSHIPS
-- =========================================================
-- Note: Owner memberships (admin) are automatically created by the trigger
-- We only need to manually add non-owner members

-- Account A members:
-- Alice = admin (owner) → Created automatically by trigger ✓

-- Bob = contributor
INSERT INTO account_members (account_id, user_id, role, created_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222',
  'contributor',
  now()
);

-- Charlie = viewer
INSERT INTO account_members (account_id, user_id, role, created_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333',
  'viewer',
  now()
);

-- Account B members:
-- Charlie = admin (owner) → Created automatically by trigger ✓

-- =========================================================
-- 4. CREATE CATEGORIES
-- =========================================================

-- Account A categories
INSERT INTO categories (id, account_id, name, icon_id, type, created_at)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Groceries', 'ShoppingCart', 'expense', now()),
  ('a2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Salary', 'Briefcase', 'income', now()),
  ('a3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Transport', 'Car', 'expense', now());

-- Account B categories
INSERT INTO categories (id, account_id, name, icon_id, type, created_at)
VALUES
  ('a4444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Freelance', 'Laptop', 'income', now()),
  ('a5555555-5555-5555-5555-555555555555', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Rent', 'House', 'expense', now());

-- =========================================================
-- 5. CREATE TRANSACTIONS
-- =========================================================

-- Account A transactions (created by different users)
INSERT INTO transactions (id, account_id, type, amount_minor, currency, amount_base_minor, category_id, date, merchant, notes, created_by, paid_by, created_at)
VALUES
  (
    'b1111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'expense',
    5000, -- 50.00 EUR
    'EUR',
    5000,
    'a1111111-1111-1111-1111-111111111111',
    '2025-01-15',
    'Supermarket XYZ',
    'Weekly groceries',
    '11111111-1111-1111-1111-111111111111', -- Alice
    '11111111-1111-1111-1111-111111111111', -- paid_by (Alice)
    now()
  ),
  (
    'b2222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'income',
    300000, -- 3000.00 EUR
    'EUR',
    300000,
    'a2222222-2222-2222-2222-222222222222',
    '2025-01-01',
    'Company ABC',
    'January salary',
    '11111111-1111-1111-1111-111111111111', -- Alice
    '11111111-1111-1111-1111-111111111111', -- paid_by (Alice)
    now()
  ),
  (
    'b3333333-3333-3333-3333-333333333333',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'expense',
    2500, -- 25.00 EUR
    'EUR',
    2500,
    'a3333333-3333-3333-3333-333333333333',
    '2025-01-10',
    'Gas Station',
    'Fuel',
    '22222222-2222-2222-2222-222222222222', -- Bob
    '22222222-2222-2222-2222-222222222222', -- paid_by (Bob)
    now()
  );

-- Account B transactions
INSERT INTO transactions (id, account_id, type, amount_minor, currency, amount_base_minor, category_id, date, merchant, notes, created_by, paid_by, created_at)
VALUES
  (
    'b4444444-4444-4444-4444-444444444444',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'income',
    150000, -- 1500.00 USD
    'USD',
    150000,
    'a4444444-4444-4444-4444-444444444444',
    '2025-01-05',
    'Client XYZ',
    'Freelance project',
    '33333333-3333-3333-3333-333333333333', -- Charlie
    '33333333-3333-3333-3333-333333333333', -- paid_by (Charlie)
    now()
  ),
  (
    'b5555555-5555-5555-5555-555555555555',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'expense',
    120000, -- 1200.00 USD
    'USD',
    120000,
    'a5555555-5555-5555-5555-555555555555',
    '2025-01-01',
    'Landlord',
    'January rent',
    '33333333-3333-3333-3333-333333333333', -- Charlie
    '33333333-3333-3333-3333-333333333333', -- paid_by (Charlie)
    now()
  );

-- =========================================================
-- 6. CREATE INVITES
-- =========================================================

-- Account A invite (created by Alice, the admin)
INSERT INTO invites (id, account_id, token_hash, role, expires_at, created_by, created_at)
VALUES (
  'd1111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  encode(sha256('test-invite-token-123'::bytea), 'hex'),
  'contributor',
  now() + interval '7 days',
  '11111111-1111-1111-1111-111111111111',
  now()
);

-- =========================================================
-- 7. SUBSCRIPTIONS CATALOG (public data)
-- =========================================================

INSERT INTO subscriptions_catalog (name, icon_id, country, cancel_url, tags)
VALUES
  ('Netflix', 'tv', 'US', 'https://www.netflix.com/cancelplan', '{"category": "entertainment"}'::jsonb),
  ('Spotify', 'music', 'US', 'https://www.spotify.com/account/subscription/', '{"category": "music"}'::jsonb),
  ('Amazon Prime', 'box', 'US', 'https://www.amazon.com/prime/cancel', '{"category": "shopping"}'::jsonb);

-- =========================================================
-- SEED SUMMARY
-- =========================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'finnon seed data created successfully!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Test Users:';
  RAISE NOTICE '  Alice   (admin of Account A): alice@finnon-test.local / password123';
  RAISE NOTICE '  Bob     (contributor of Account A): bob@finnon-test.local / password123';
  RAISE NOTICE '  Charlie (viewer of Account A, admin of Account B): charlie@finnon-test.local / password123';
  RAISE NOTICE '  David   (no account access): david@finnon-test.local / password123';
  RAISE NOTICE '';
  RAISE NOTICE 'Accounts:';
  RAISE NOTICE '  Account A (Alice Family Budget - EUR): 3 members, 3 categories, 3 transactions';
  RAISE NOTICE '  Account B (Charlie Personal - USD): 1 member, 2 categories, 2 transactions';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run the validation script: psql -f supabase/validate-rls.sql';
  RAISE NOTICE '  2. Test manually in Supabase Studio';
  RAISE NOTICE '============================================';
END $$;
