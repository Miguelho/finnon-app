-- Enforce that account owners exist in auth.users

ALTER TABLE accounts
  ADD CONSTRAINT accounts_owner_user_id_fkey
  FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
