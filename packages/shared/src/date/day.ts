const toDate = (value: Date | string): Date => {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date("") : parsed;
};

export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const isFutureDay = (value: Date | string): boolean => {
  const parsed = toDate(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return startOfDay(parsed).getTime() > startOfDay(new Date()).getTime();
};
