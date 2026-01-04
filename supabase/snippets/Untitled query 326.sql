select auth.uid();

select * from auth.users;
select * from accounts;
select * from CATEGORIES;
select * from transactions;
select * from recurring_items;
select * from invites;
select * from account_members;

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