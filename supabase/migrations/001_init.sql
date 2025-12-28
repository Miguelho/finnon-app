-- finnon v1 — Initial schema
-- Creates all base tables for accounts, members, categories, transactions, attachments, invites, and subscriptions

-- =========================================================
-- 1. ACCOUNTS
-- =========================================================
-- Note: IF NOT EXISTS makes this migration idempotent (safe to re-run)
-- but does NOT protect against writing test data to production.
-- Use separate Supabase projects or local development for environment isolation.

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 255),
  base_currency char(3) NOT NULL,
  owner_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE accounts IS 'User accounts (money management accounts)';
COMMENT ON COLUMN accounts.base_currency IS 'ISO 4217 currency code (e.g., USD, EUR, JPY)';
COMMENT ON COLUMN accounts.owner_user_id IS 'References auth.users - the creator/owner of this account';

-- =========================================================
-- 2. ACCOUNT_MEMBERS
-- =========================================================
CREATE TABLE IF NOT EXISTS account_members (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('viewer', 'contributor', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, user_id)
);

COMMENT ON TABLE account_members IS 'Many-to-many relationship between accounts and users with roles';
COMMENT ON COLUMN account_members.role IS 'viewer: read-only | contributor: can create/edit transactions | admin: full control';

-- =========================================================
-- 3. CATEGORIES
-- =========================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 255),
  icon_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE categories IS 'Transaction categories (per account)';
COMMENT ON COLUMN categories.icon_id IS 'Icon identifier from shared icon library';

CREATE INDEX IF NOT EXISTS idx_categories_account_id ON categories(account_id);

-- =========================================================
-- 4. TRANSACTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL,
  amount_base_minor bigint NOT NULL CHECK (amount_base_minor >= 0),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  date date NOT NULL,
  merchant text CHECK (merchant IS NULL OR char_length(merchant) <= 255),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE transactions IS 'Income and expense transactions';
COMMENT ON COLUMN transactions.amount_minor IS 'Amount in minor currency units (cents, pennies, etc.) - stores as integer to avoid floating point errors';
COMMENT ON COLUMN transactions.amount_base_minor IS 'Amount converted to account base_currency in minor units';
COMMENT ON COLUMN transactions.created_by IS 'References auth.users - who created this transaction';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date DESC);

-- =========================================================
-- 5. ATTACHMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  mime text NOT NULL,
  size bigint NOT NULL CHECK (size >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE attachments IS 'File attachments (photos, receipts) for transactions';
COMMENT ON COLUMN attachments.storage_path IS 'Path in Supabase Storage bucket';
COMMENT ON COLUMN attachments.size IS 'File size in bytes';

CREATE INDEX IF NOT EXISTS idx_attachments_transaction_id ON attachments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_attachments_account_id ON attachments(account_id);

-- =========================================================
-- 6. INVITES
-- =========================================================
CREATE TABLE IF NOT EXISTS invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('viewer', 'contributor', 'admin')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  max_uses int CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count int NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE invites IS 'Account invitation tokens (hashed for security)';
COMMENT ON COLUMN invites.token_hash IS 'SHA-256 hash of the invite token (never store plaintext)';
COMMENT ON COLUMN invites.max_uses IS 'Maximum number of uses (NULL = unlimited)';
COMMENT ON COLUMN invites.created_by IS 'References auth.users - who created this invite';

CREATE INDEX IF NOT EXISTS idx_invites_account_id ON invites(account_id);
CREATE INDEX IF NOT EXISTS idx_invites_token_hash ON invites(token_hash);

-- =========================================================
-- 7. SUBSCRIPTIONS_CATALOG
-- =========================================================
CREATE TABLE IF NOT EXISTS subscriptions_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon_id text NOT NULL,
  country char(2),
  cancel_url text NOT NULL,
  tags jsonb
);

COMMENT ON TABLE subscriptions_catalog IS 'Directory of subscription services with cancellation URLs';
COMMENT ON COLUMN subscriptions_catalog.country IS 'ISO 3166-1 alpha-2 country code (e.g., US, ES, GB)';
COMMENT ON COLUMN subscriptions_catalog.tags IS 'Additional metadata (category, platform, etc.)';

CREATE INDEX IF NOT EXISTS idx_subscriptions_country ON subscriptions_catalog(country);
