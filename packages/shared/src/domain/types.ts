import type { CategoryIconKey } from "../icons/category-icons";

export type UserRole = "viewer" | "contributor" | "admin";

export type Participant = {
  user_id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
};

export type Account = {
  id: string;
  name: string;
  base_currency: string;
};

export type TransactionCategory = {
  id: string;
  name: string;
  icon_id?: CategoryIconKey | null;
};

export type Transaction = {
  id: string;
  account_id: string;
  type: "income" | "expense";
  amount_minor: bigint | number | string;
  amount_base_minor?: bigint | number | string | null;
  currency: string;
  date: string | Date;
  merchant?: string | null;
  notes?: string | null;
  category_id?: string | null;
  obligation_id?: string | null;
  category?: TransactionCategory | null;
  recurring_item_id?: string | null;
  recurring_occurrence_date?: string | null;
  created_at?: string | Date;
};

export type ObligationStatus = "pending" | "paid";

export type Obligation = {
  id: string;
  account_id: string;
  name: string;
  amount_minor: bigint | number | string;
  amount_base_minor?: bigint | number | string | null;
  currency: string;
  due_date: string | Date;
  status?: ObligationStatus | null;
  paid_at?: string | Date | null;
};
