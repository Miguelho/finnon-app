-- Auto-add account owner as admin member when account is created

CREATE OR REPLACE FUNCTION add_owner_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with owner privileges (bypasses RLS)
SET search_path = public  -- Security: prevent search_path attacks
AS $$
BEGIN
  -- Automatically add the owner as an admin member
  -- SECURITY DEFINER allows this to bypass RLS policies on account_members
  INSERT INTO account_members (account_id, user_id, role)
  VALUES (NEW.id, NEW.owner_user_id, 'admin');

  RETURN NEW;
END;
$$;

-- Trigger that runs after inserting a new account
CREATE TRIGGER account_owner_auto_admin
  AFTER INSERT ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION add_owner_as_admin();

COMMENT ON FUNCTION add_owner_as_admin IS 'Automatically adds the account owner as an admin member when a new account is created';
