export type MovementType = "income" | "expense";
export type MovementStatus = "confirmed" | "pending";

export interface UserProfile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_path: string | null;
  avatar_fallback_text: string | null;
  avatar_fallback_bg_token: string | null;
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

export const movementsDesignTokens = {
  colors: {
    bg: "#FAFAFA",
    surface: "#FFFFFF",
    border: "#F0F0F0",
    borderStrong: "#E5E5E5",
    textPrimary: "#1A1A1A",
    textSecondary: "#6B6B6B",
    textTertiary: "#9B9B9B",
    incomeGreen: "#22A06B",
    incomeGreenBg: "#E6F9F0",
    expenseRed: "#DE350B",
    expenseRedBg: "#FFF0E6",
    pendingAmber: "#E2850A",
    pendingAmberBg: "#FFF8E6",
    pendingAmberBorder: "#F5D990",
    recurrentPurple: "#7C5CFC",
    recurrentPurpleBg: "#F3F0FF",
    recurrentPurpleBorder: "#D4CCFF",
    accentBlue: "#0065FF",
    accentBlueBg: "#E6F0FF",
    chipBg: "#F5F5F5",
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 999,
  },
  typography: {
    fontFamily: "DMSans",
    sizes: {
      xs: 11,
      sm: 12,
      base: 13,
      md: 14,
      lg: 15,
      xl: 20,
      "2xl": 24,
    },
    weights: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },
} as const;
