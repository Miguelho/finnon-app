import {
  movementsTokens,
  type AvatarColorToken,
  type UserAvatarColorId,
} from "@poleursus/shared";

export type MovementType = "income" | "expense";
export type MovementStatus = "confirmed" | "pending";

export interface UserProfile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_path: string | null;
  avatar_fallback_text: string | null;
  avatar_fallback_bg_token: AvatarColorToken | null;
  avatar_color: UserAvatarColorId | null;
}

export interface Category {
  id: string;
  name: string;
  icon_id: string | null;
  type?: MovementType | null;
  account_id: string;
}

export interface Movement {
  id: string;
  title: string;
  amountMinor: bigint;
  date: string;
  categoryId: string | null;
  categoryName: string;
  categoryIconId?: string | null;
  subcategory?: string | null;
  userId: string;
  accountId: string;
  status: MovementStatus;
  type: MovementType;
  merchant?: string | null;
  recurringItemId?: string | null;
  recurringOccurrenceDate?: string | null;
}

export interface RecurringTemplate {
  id: string;
  templateId: string;
  title: string;
  amountMinor: bigint;
  expectedDate: string;
  categoryId: string | null;
  categoryName: string;
  categoryIconId?: string | null;
  subcategory?: string | null;
  userId: string;
  accountId: string;
  type: MovementType;
  currency: string;
  isRegisteredThisMonth: boolean;
}

export type MovementFilter = {
  types: Array<"income" | "expense">;
  categoryIds: string[];
  merchantNames: string[];
  searchQuery: string;
};

export interface MovementsSummary {
  totalIncome: bigint;
  totalExpense: bigint;
  totalBalance: bigint;
  confirmedIncome: bigint;
  confirmedExpense: bigint;
  confirmedBalance: bigint;
}

export const movementsDesignTokens = movementsTokens;
