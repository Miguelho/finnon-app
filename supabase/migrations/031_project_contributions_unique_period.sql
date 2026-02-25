-- =========================================================
-- 31. PROJECT CONTRIBUTIONS UNIQUE BY PROJECT+PERIOD
-- =========================================================

DROP INDEX IF EXISTS public.idx_project_contributions_project_period_user;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY project_id, period
      ORDER BY confirmed DESC, confirmed_at DESC NULLS LAST, created_at DESC, id DESC
    ) AS rn
  FROM public.project_contributions
)
DELETE FROM public.project_contributions target
USING ranked
WHERE target.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_contributions_project_period_unique
  ON public.project_contributions USING btree (project_id, period);

CREATE INDEX IF NOT EXISTS idx_project_contributions_account_period
  ON public.project_contributions USING btree (account_id, period DESC);
