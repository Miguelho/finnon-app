export type IconDefinition = {
  id: string;
  emoji: string;
  label: string;
  suggested_for?: "income" | "expense" | "both";
};

export const ICONS: IconDefinition[] = [
  // Income icons
  { id: "salary", emoji: "💰", label: "Salary", suggested_for: "income" },
  { id: "gift", emoji: "🎁", label: "Gift", suggested_for: "income" },
  { id: "investment", emoji: "📈", label: "Investment", suggested_for: "income" },
  { id: "refund", emoji: "💵", label: "Refund", suggested_for: "income" },
  { id: "bonus", emoji: "🎉", label: "Bonus", suggested_for: "income" },

  // Expense icons - Essential
  { id: "food", emoji: "🍔", label: "Food", suggested_for: "expense" },
  { id: "groceries", emoji: "🛒", label: "Groceries", suggested_for: "expense" },
  { id: "transport", emoji: "🚗", label: "Transport", suggested_for: "expense" },
  { id: "home", emoji: "🏠", label: "Home", suggested_for: "expense" },
  { id: "utilities", emoji: "💡", label: "Utilities", suggested_for: "expense" },
  { id: "health", emoji: "🏥", label: "Health", suggested_for: "expense" },
  { id: "insurance", emoji: "🛡️", label: "Insurance", suggested_for: "expense" },

  // Expense icons - Lifestyle
  { id: "shopping", emoji: "🛍️", label: "Shopping", suggested_for: "expense" },
  { id: "entertainment", emoji: "🎬", label: "Entertainment", suggested_for: "expense" },
  { id: "education", emoji: "📚", label: "Education", suggested_for: "expense" },
  { id: "sports", emoji: "⚽", label: "Sports", suggested_for: "expense" },
  { id: "travel", emoji: "✈️", label: "Travel", suggested_for: "expense" },
  { id: "coffee", emoji: "☕", label: "Coffee", suggested_for: "expense" },
  { id: "restaurant", emoji: "🍽️", label: "Restaurant", suggested_for: "expense" },

  // Expense icons - Services & Bills
  { id: "phone", emoji: "📱", label: "Phone", suggested_for: "expense" },
  { id: "internet", emoji: "🌐", label: "Internet", suggested_for: "expense" },
  { id: "subscription", emoji: "📺", label: "Subscription", suggested_for: "expense" },
  { id: "gym", emoji: "💪", label: "Gym", suggested_for: "expense" },
  { id: "beauty", emoji: "💅", label: "Beauty", suggested_for: "expense" },

  // Generic/Both
  { id: "other", emoji: "📦", label: "Other", suggested_for: "both" },
  { id: "general", emoji: "⭐", label: "General", suggested_for: "both" },
  { id: "cash", emoji: "💸", label: "Cash", suggested_for: "both" },
  { id: "card", emoji: "💳", label: "Card", suggested_for: "both" },
  { id: "bank", emoji: "🏦", label: "Bank", suggested_for: "both" },
];

export function getIconById(id: string): IconDefinition | undefined {
  return ICONS.find((icon) => icon.id === id);
}

export function getIconsByType(
  type: "income" | "expense" | "both"
): IconDefinition[] {
  return ICONS.filter(
    (icon) => icon.suggested_for === type || icon.suggested_for === "both"
  );
}
