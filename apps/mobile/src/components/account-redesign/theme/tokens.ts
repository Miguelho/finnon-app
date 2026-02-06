/**
 * Finnon Design Tokens
 *
 * Fuente única de verdad para todos los valores visuales.
 * Si mañana cambias la paleta o la tipografía, solo tocas este archivo.
 */

export const colors = {
  // Backgrounds
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F4F0',

  // Borders
  border: '#E8E6E1',
  borderLight: '#F0EEE9',

  // Text
  textPrimary: '#1A1A18',
  textSecondary: '#6B6B65',
  textTertiary: '#9C9C95',

  // Semantic — Income
  income: '#1B7A4A',
  incomeBg: '#E8F5EE',
  incomeLight: '#D0EBDD',

  // Semantic — Expense
  expense: '#C4441A',
  expenseBg: '#FDF0EB',
  expenseLight: '#F9DDD2',

  // Accent
  accent: '#2563EB',
  accentBg: '#EFF4FF',

  // Category backgrounds
  category: {
    casa: '#FEF3C7',
    familia: '#FCE7F3',
    ocio: '#E0E7FF',
    restaurantes: '#FFEDD5',
    interests: '#D1FAE5',
    lottery: '#EDE9FE',
    default: '#F3F4F6',
  },
} as const;

export const typography = {
  // Familias — usa expo-font para cargar estas
  family: {
    sans: 'DMSans',
    sansMedium: 'DMSans-Medium',
    sansSemiBold: 'DMSans-SemiBold',
    sansBold: 'DMSans-Bold',
    mono: 'JetBrainsMono',
    monoMedium: 'JetBrainsMono-Medium',
  },

  // Tamaños (sin familia, se compone en los componentes)
  size: {
    xs: 10,
    sm: 11,
    base: 12,
    md: 13,
    lg: 14,
    xl: 16,
    '2xl': 18,
    '3xl': 24,
    '4xl': 36,
  },

  lineHeight: {
    tight: 1.1,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 14,
  '3xl': 16,
  '4xl': 20,
  '5xl': 24,
  '6xl': 32,
} as const;

export const radii = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 20,
  full: 100,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;
