const toDate = (value: Date | string): Date => {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date("") : parsed;
};

export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const toDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isSameDay = (
  left: Date | null | undefined,
  right: Date | null | undefined
): boolean => {
  if (!left || !right) return false;
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
};

export const toMondayIndex = (weekday: number): number => (weekday + 6) % 7;

export const isFutureDay = (value: Date | string): boolean => {
  const parsed = toDate(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return startOfDay(parsed).getTime() > startOfDay(new Date()).getTime();
};
