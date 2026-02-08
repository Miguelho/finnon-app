// ============================================================================
// FINNON — Movimientos Screen Components
// React Native + TypeScript + Tailwind (NativeWind)
// ============================================================================

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayInitial: string; // First letter of email, uppercase
  color: string; // Hex color for avatar background
  textColor: string; // Hex color for avatar text
}

export interface Category {
  id: string;
  name: string;
  icon: string; // Emoji or icon identifier
  accountId: string;
}

export interface Movement {
  id: string;
  title: string; // Merchant/payee name
  amount: number; // Positive for income, negative for expense
  date: string; // ISO date string
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  subcategory?: string; // Optional description (e.g., "Leasing Niro", "Cuenta remunerada euros")
  userId: string;
  accountId: string;
  status: 'confirmed' | 'pending'; // pending = registered but future date
  type: 'income' | 'expense';
}

export interface RecurringTemplate {
  id: string;
  title: string;
  amount: number;
  expectedDate: string; // ISO date for this month's expected date
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  subcategory?: string;
  userId: string;
  accountId: string;
  type: 'income' | 'expense';
  isRegisteredThisMonth: boolean;
}

export type MovementFilter = {
  type?: 'income' | 'expense';
  categoryId?: string;
  merchantName?: string;
  searchQuery?: string; // Global search across all months
};

export interface MovementsSummary {
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  confirmedIncome: number;
  confirmedExpense: number;
  confirmedBalance: number; // "actual" balance
}

export interface MovementsScreenState {
  selectedMonth: { month: number; year: number };
  filters: MovementFilter;
  isSearchMode: boolean; // true when searchQuery is non-empty
  isRecurrentSectionCollapsed: boolean;
  movements: Movement[];
  unregisteredRecurrents: RecurringTemplate[];
  summary: MovementsSummary;
}

// ─── COMPONENT TREE ────────────────────────────────────────────────────────

/**
 * MovementsScreen (root)
 * ├── PageHeader
 * ├── MonthNavigator
 * │   ├── ArrowButton (prev/next)
 * │   ├── MonthLabel
 * │   ├── CalendarPickerButton
 * │   └── RecurrentesLink
 * ├── SummaryCards
 * │   ├── SummaryCard (income)
 * │   ├── SummaryCard (expense)
 * │   └── SummaryCard (balance)
 * ├── RecurrentSection (conditional: only when unregisteredRecurrents.length > 0)
 * │   ├── RecurrentHeader (with collapse toggle)
 * │   ├── RecurrentCard[] (one per unregistered recurrent)
 * │   └── RegisterAllButton
 * ├── SearchBar
 * │   └── GlobalSearchBadge (conditional: visible when input has text)
 * ├── FilterRow
 * │   ├── FilterChip (Ingresos)
 * │   ├── FilterChip (Gastos)
 * │   ├── FilterSeparator
 * │   ├── DropdownFilter (Categoría)
 * │   └── DropdownFilter (Comercio)
 * ├── ActiveFilterTags (conditional: only when filters active)
 * ├── SearchModeBar (conditional: only in search mode)
 * ├── MovementGroup (Pendientes — conditional: only in current/future months)
 * │   ├── GroupHeader
 * │   ├── DateSeparator[]
 * │   └── MovementRow[] (pending-row variant)
 * └── MovementGroup (Realizados)
 *     ├── GroupHeader
 *     ├── DateSeparator[]
 *     └── MovementRow[]
 */

// ─── COMPONENT SPECS ───────────────────────────────────────────────────────

/**
 * SummaryCard
 * 
 * Props:
 *   label: string ("Ingresos" | "Gastos" | "Balance")
 *   totalValue: number (projected total including pending)
 *   confirmedValue: number (only confirmed movements)
 *   confirmedLabel: string ("confirmados" | "actual")
 *   variant: 'income' | 'expense' | 'balance'
 *   accentColor: string (left border color)
 * 
 * Visual:
 *   - White card with 1px border, 3px colored left border
 *   - Total value large and bold, colored by variant
 *   - Confirmed subtitle small, gray, with bold number
 */

/**
 * RecurrentSection
 * 
 * Props:
 *   recurrents: RecurringTemplate[]
 *   onRegister: (id: string) => void
 *   onRegisterAll: () => void
 *   isCollapsed: boolean
 *   onToggleCollapse: () => void
 * 
 * Visual:
 *   - Purple color scheme (#7C5CFC / #F3F0FF / #D4CCFF)
 *   - Header with icon, label "Por registrar", count, collapse button
 *   - Each RecurrentCard: purple bg, icon, name, meta, amount, "Registrar" button
 *   - "Registrar todos (N)" full-width button at bottom
 *   - Animate cards out on register (slide right + fade)
 *   - Entire section disappears when empty
 * 
 * Behavior:
 *   - onRegister: removes template, creates Movement with status based on date
 *     - date <= today → status: 'confirmed' → goes to Realizados
 *     - date > today → status: 'pending' → goes to Pendientes
 *   - Section is collapsible (toggle between "Ocultar" / "Mostrar")
 */

/**
 * SearchBar
 * 
 * Props:
 *   value: string
 *   onChange: (text: string) => void
 *   onClear: () => void
 * 
 * Behavior:
 *   - When text is entered:
 *     1. MonthNavigator hides (animated)
 *     2. SearchModeBar appears ("Mostrando resultados de todos los meses")
 *     3. Movements list filters across ALL months (not just selected month)
 *     4. Results maintain Pendientes/Realizados grouping
 *   - When cleared: revert to month-scoped view
 *   - Badge "Búsqueda global" appears inside input when focused/has text
 */

/**
 * FilterChip
 * 
 * Props:
 *   label: string
 *   count: number
 *   isActive: boolean
 *   onToggle: () => void
 * 
 * Visual:
 *   - Inactive: white bg, gray border, gray text
 *   - Active: black bg, white text
 *   - Count shown in smaller text next to label
 */

/**
 * DropdownFilter
 * 
 * Props:
 *   label: string ("Categoría" | "Comercio")
 *   options: { id: string; name: string }[]
 *   selectedIds: string[]
 *   onSelect: (id: string) => void
 *   onDeselect: (id: string) => void
 * 
 * Visual:
 *   - Chip trigger with chevron icon
 *   - Dropdown panel: search input + scrollable list
 *   - Selected items show checkmark
 *   - Multi-select supported
 * 
 * Behavior:
 *   - Options are dynamic per account (loaded from categories/merchants)
 *   - Internal search filters the list
 *   - Close on outside tap
 */

/**
 * MovementGroup
 * 
 * Props:
 *   label: string ("Pendientes" | "Realizados")
 *   variant: 'pending' | 'done'
 *   movements: Movement[]
 *   totalAmount: number (net for the group)
 *   dotColor: string
 * 
 * Visual:
 *   - Header with colored dot, label, count, net amount
 *   - Movements grouped by date with DateSeparator
 *   - Pending group: amber-tinted rows
 *   - Done group: white rows
 */

/**
 * MovementRow
 * 
 * Props:
 *   movement: Movement
 *   user: User
 *   variant: 'default' | 'pending'
 *   onPress: (id: string) => void
 * 
 * Visual:
 *   - Grid: [icon 36px] [info flex] [amount + badges]
 *   - Icon: category emoji in rounded square
 *   - Info: merchant name (bold) + category · subcategory (gray)
 *   - Amount: green for income, red for expense, reduced opacity for pending
 *   - User badge: circular avatar with initial
 *   - Pending variant: amber background
 */

// ─── DESIGN TOKENS (for Tailwind/NativeWind config) ────────────────────────

export const designTokens = {
  colors: {
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    border: '#F0F0F0',
    borderStrong: '#E5E5E5',
    textPrimary: '#1A1A1A',
    textSecondary: '#6B6B6B',
    textTertiary: '#9B9B9B',
    incomeGreen: '#22A06B',
    incomeGreenBg: '#E6F9F0',
    expenseRed: '#DE350B',
    expenseRedBg: '#FFF0E6',
    pendingAmber: '#E2850A',
    pendingAmberBg: '#FFF8E6',
    pendingAmberBorder: '#F5D990',
    recurrentPurple: '#7C5CFC',
    recurrentPurpleBg: '#F3F0FF',
    recurrentPurpleBorder: '#D4CCFF',
    accentBlue: '#0065FF',
    accentBlueBg: '#E6F0FF',
    chipBg: '#F5F5F5',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 999,
  },
  typography: {
    fontFamily: 'DM Sans',
    sizes: {
      xs: 11,
      sm: 12,
      base: 13,
      md: 14,
      lg: 15,
      xl: 20,
      '2xl': 24,
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
} as const;

// ─── STATE MANAGEMENT (Zustand store shape) ────────────────────────────────

/**
 * Zustand store for Movements screen
 * 
 * interface MovementsStore {
 *   // State
 *   selectedMonth: { month: number; year: number };
 *   filters: MovementFilter;
 *   isSearchMode: boolean;
 *   isRecurrentSectionCollapsed: boolean;
 *   
 *   // Computed (derive in selectors, not stored)
 *   // - filteredMovements: Movement[]
 *   // - groupedByStatus: { pending: Movement[]; confirmed: Movement[] }
 *   // - summary: MovementsSummary
 *   // - unregisteredRecurrents: RecurringTemplate[]
 *   
 *   // Actions
 *   setMonth: (month: number, year: number) => void;
 *   toggleFilter: (filter: Partial<MovementFilter>) => void;
 *   setSearchQuery: (query: string) => void;
 *   clearFilters: () => void;
 *   registerRecurrent: (templateId: string) => void;
 *   registerAllRecurrents: () => void;
 *   toggleRecurrentCollapse: () => void;
 * }
 */

// ─── DATA FLOW ─────────────────────────────────────────────────────────────

/**
 * 1. On mount: fetch movements for selectedMonth from Supabase
 * 2. On month change: refetch movements for new month
 * 3. On search: query ALL movements matching searchQuery (no month filter)
 * 4. On filter toggle: apply client-side filtering
 * 5. Summary computed client-side from current movement set
 * 6. Recurrents: fetch templates where isRegisteredThisMonth === false
 * 7. On register: 
 *    a. Create new Movement from template
 *    b. Mark template as registered for this month
 *    c. New movement appears in Pendientes or Realizados based on date vs today
 */
