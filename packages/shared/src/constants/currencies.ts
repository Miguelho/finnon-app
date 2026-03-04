export const CURRENCIES = [
  { code: "EUR", name: "Euro", name_en: "Euro", symbol: "€" },
  {
    code: "USD",
    name: "Dólar estadounidense",
    name_en: "US Dollar",
    symbol: "$",
  },
  { code: "GBP", name: "Libra esterlina", name_en: "Pound Sterling", symbol: "£" },
  { code: "JPY", name: "Yen japonés", name_en: "Japanese Yen", symbol: "¥" },
  { code: "CHF", name: "Franco suizo", name_en: "Swiss Franc", symbol: "CHF" },
  { code: "CAD", name: "Dólar canadiense", name_en: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", name: "Dólar australiano", name_en: "Australian Dollar", symbol: "A$" },
  { code: "MXN", name: "Peso mexicano", name_en: "Mexican Peso", symbol: "MX$" },
  { code: "BRL", name: "Real brasileño", name_en: "Brazilian Real", symbol: "R$" },
  { code: "ARS", name: "Peso argentino", name_en: "Argentine Peso", symbol: "AR$" },
  { code: "COP", name: "Peso colombiano", name_en: "Colombian Peso", symbol: "CO$" },
  { code: "CLP", name: "Peso chileno", name_en: "Chilean Peso", symbol: "CL$" },
  { code: "PEN", name: "Sol peruano", name_en: "Peruvian Sol", symbol: "S/" },
] as const;

export type CurrencyCode = typeof CURRENCIES[number]["code"];
