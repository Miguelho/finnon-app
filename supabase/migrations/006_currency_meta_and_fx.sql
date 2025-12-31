-- =========================================================
-- 6. CURRENCY META + FX SUPPORT
-- =========================================================
CREATE TABLE IF NOT EXISTS currency_meta (
  code char(3) PRIMARY KEY,
  minor_units smallint NOT NULL
);

INSERT INTO currency_meta (code, minor_units) VALUES
  ('EUR', 2),
  ('USD', 2),
  ('GBP', 2),
  ('JPY', 0),
  ('CHF', 2),
  ('PLN', 2),
  ('KWD', 3),
  ('BHD', 3)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS fx_rate numeric(18,10) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fx_date date;

UPDATE transactions
SET fx_date = date
WHERE fx_date IS NULL;

ALTER TABLE transactions
  ALTER COLUMN fx_date SET NOT NULL,
  ALTER COLUMN fx_date SET DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_transactions_account_category_date
  ON transactions(account_id, category_id, date DESC);

CREATE OR REPLACE FUNCTION get_minor_units(p_code char(3))
RETURNS smallint
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result smallint;
BEGIN
  SELECT minor_units INTO result FROM currency_meta WHERE code = p_code;
  IF result IS NULL THEN
    RAISE NOTICE 'Unknown currency code %, defaulting to 2', p_code;
    RETURN 2;
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION compute_amount_base_minor(
  p_amount_minor bigint,
  p_currency char(3),
  p_base_currency char(3),
  p_fx_rate numeric(18,10)
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  mu smallint;
  mu_base smallint;
  amount_major numeric;
  amount_base_major numeric;
  amount_base_minor numeric;
BEGIN
  mu := get_minor_units(p_currency);
  mu_base := get_minor_units(p_base_currency);

  amount_major := p_amount_minor::numeric / (10 ^ mu);
  amount_base_major := amount_major * p_fx_rate;
  amount_base_minor := round(amount_base_major * (10 ^ mu_base));

  RETURN amount_base_minor::bigint;
END;
$$;
