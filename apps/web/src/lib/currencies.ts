export const CURRENCIES = [
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "USD", name: "Dólar estadounidense", symbol: "$" },
  { code: "GBP", name: "Libra esterlina", symbol: "£" },
  { code: "JPY", name: "Yen japonés", symbol: "¥" },
  { code: "CHF", name: "Franco suizo", symbol: "CHF" },
  { code: "CAD", name: "Dólar canadiense", symbol: "C$" },
  { code: "AUD", name: "Dólar australiano", symbol: "A$" },
  { code: "MXN", name: "Peso mexicano", symbol: "MX$" },
  { code: "BRL", name: "Real brasileño", symbol: "R$" },
  { code: "ARS", name: "Peso argentino", symbol: "AR$" },
  { code: "COP", name: "Peso colombiano", symbol: "CO$" },
  { code: "CLP", name: "Peso chileno", symbol: "CL$" },
  { code: "PEN", name: "Sol peruano", symbol: "S/" },
] as const;

export type CurrencyCode = typeof CURRENCIES[number]["code"];
