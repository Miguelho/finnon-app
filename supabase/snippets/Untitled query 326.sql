select auth.uid();

select * from auth.users;
select * from accounts;
select * from CATEGORIES;
select * from transactions where id in ('19f75bb3-76c7-45d9-bab2-9dc9f7293a91', '78bd9772-2840-45f0-b1c4-7a7e2d83ad06', '2942bd87-e229-4f49-ad4d-2f6842ee00db');
select * from recurring_items;
select * from invites;
select * from profiles;
select * from financial_goals;
select account_id, role, a.id, a.name
from account_members am
LEFT JOIN accounts a ON a.id = am.account_id
where user_id = '6ebf08cb-28f4-40a0-84ea-0857061f03ad' and am.role='admin'
;

SELECT *
FROM pg_catalog.pg_tables
WHERE schemaname != 'pg_catalog' AND
    schemaname != 'information_schema' and schemaname='public';

select column_name, data_type, character_maximum_length, column_default, is_nullable
  from INFORMATION_SCHEMA.COLUMNS
 where table_name = 'accounts'
 order by ordinal_position;

-- 1. Ver el membership del usuario
SELECT * FROM account_members 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test_user@test.com');

-- 2. Ver si la cuenta asociada existe
SELECT am.account_id, am.role, a.id as account_exists, a.name
FROM account_members am
LEFT JOIN accounts a ON a.id = am.account_id
WHERE am.user_id = (SELECT id FROM auth.users WHERE email = 'test_user@test.com');

-- 3. Contar cuentas existentes
SELECT COUNT(*) FROM accounts;


SELECT id, token_type, token_hash, created_at FROM auth.one_time_tokens WHERE token_hash LIKE '%c5c13492%';
SELECT token_hash, created_at FROM auth.one_time_tokens ORDER BY created_at DESC LIMIT 1;
SELECT id, user_id, authentication_method, created_at FROM auth.flow_state  ORDER BY created_at DESC LIMIT 3;

--delete from invites where id = 'd1111111-1111-1111-1111-111111111111';

select id from accounts where owner_user_id ='b28e22b0-8221-4f9e-99c1-4bfe0c394dca';
select a.*,m.*
from accounts a
join account_members m on m.account_id = a.id
where m.user_id = '5f404613-5a34-4a86-a186-3fc3447798f2';

update account_members
set role ='admin'
where account_id = 'ab9446c1-73a3-4a95-8667-dd64264ad7ab' and user_id='b28e22b0-8221-4f9e-99c1-4bfe0c394dca'



SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'accounts';

SELECT
  *
FROM pg_policies
WHERE tablename = 'account_members';

SELECT 
  proname as function_name,
  CASE provolatile
    WHEN 'i' THEN 'IMMUTABLE ❌'
    WHEN 's' THEN 'STABLE ❌'
    WHEN 'v' THEN 'VOLATILE ✓'
  END as volatility_status
FROM pg_proc 
WHERE proname IN ('is_account_member', 'is_account_admin', 'is_contributor_or_above', 'get_account_role')
ORDER BY proname;


select id from accounts limit 10;
select user_id from account_members where account_id = '91745193-572a-4a72-9a2d-01a4011f50c5';

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"e751bfe6-8a9c-41e0-a349-f449c1b93161"}';

select jsonb_pretty(
  get_merchant_suggestions('91745193-572a-4a72-9a2d-01a4011f50c5'::uuid, 10, 90)
);
commit;


INSERT INTO financial_goals (account_id, month, type, target_amount_base_minor, created_by, final_saved_minor, completed, completed_at, closed_at)
VALUES (
  '91745193-572a-4a72-9a2d-01a4011f50c5',
  '2025-12',
  'save',
  100000, -- €1000
  '6ebf08cb-28f4-40a0-84ea-0857061f03ad',
  120000, -- €1200 (cumplido)
  true,
  '2025-12-25',
  '2025-01-01 00:00:00'
);

update financial_goals
set completed=true, completed_at='2026-01-26', closed_at='2026-02-01 00:00:00', final_saved_minor=100000
where account_id='91745193-572a-4a72-9a2d-01a4011f50c5'
;

select get_goal_gamification('91745193-572a-4a72-9a2d-01a4011f50c5');