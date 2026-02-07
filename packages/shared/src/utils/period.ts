import { type Period, type DateRange } from "../types/period";

/**
 * Calcula el rango de fechas para un periodo dado.
 * "start" es el inicio del periodo, "end" es el final del día actual.
 */
export const getPeriodRange = (period: Period, now: Date = new Date()): DateRange => {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case "week":
      return {
        start: new Date(startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000),
        end: endOfDay,
      };
    case "month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: endOfDay,
      };
    case "quarter": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        start: new Date(now.getFullYear(), quarterStartMonth, 1),
        end: endOfDay,
      };
    }
    case "year":
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: endOfDay,
      };
  }
};

/**
 * Devuelve el final del periodo (fin del dia) para un periodo dado.
 */
export const getPeriodEnd = (period: Period, now: Date = new Date()): Date => {
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case "week":
      return endOfDay;
    case "month":
      return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    case "quarter": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);
    }
    case "year":
      return new Date(now.getFullYear(), 12, 0, 23, 59, 59, 999);
  }
};

/**
 * Formatea una fecha como string ISO "YYYY-MM-DD" para queries a Supabase.
 */
export const formatDateISO = (date: Date): string => {
  return date.toISOString().split("T")[0];
};
