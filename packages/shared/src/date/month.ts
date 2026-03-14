export const toMonthKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

export const startOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);

export const endOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

export const addMonths = (monthKey: string, delta: number): string => {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return toMonthKey(new Date());
  }

  const date = new Date(year, monthIndex + delta, 1);
  return toMonthKey(date);
};

export const formatMonthLabel = (monthKey: string, locale?: string): string => {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return monthKey;
  }

  const date = new Date(year, monthIndex, 1);
  return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
};

const normalizeMonthKey = (monthKey: string): string => {
  if (!MONTH_KEY_PATTERN.test(monthKey)) {
    return toMonthKey(new Date());
  }
  return monthKey;
};

export const getLatestClosableMonthKey = (currentMonthKey?: string): string => {
  const resolvedCurrentMonthKey = normalizeMonthKey(currentMonthKey ?? toMonthKey(new Date()));
  return addMonths(resolvedCurrentMonthKey, -1);
};

export const clampMonthKeyToLatestClosable = (
  monthKey: string,
  currentMonthKey?: string
): string => {
  const normalizedMonthKey = normalizeMonthKey(monthKey);
  const latestClosableMonthKey = getLatestClosableMonthKey(currentMonthKey);
  return normalizedMonthKey > latestClosableMonthKey
    ? latestClosableMonthKey
    : normalizedMonthKey;
};

export const getMonthRangeFromKey = (
  monthKey: string
): { monthKey: string; start: string; end: string } => {
  const normalized = normalizeMonthKey(monthKey);
  const [yearStr, monthStr] = normalized.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = `${normalized}-01`;
  const end = new Date(Date.UTC(year, monthIndex + 1, 0))
    .toISOString()
    .slice(0, 10);

  return { monthKey: normalized, start, end };
};

export const getRecentMonthKeys = (count: number = 12): string[] => {
  const currentKey = toMonthKey(new Date());
  const keys: string[] = [currentKey];
  for (let i = 1; i < count; i++) {
    keys.push(addMonths(currentKey, -i));
  }
  return keys;
};
