export type AddActionKey =
  | "expense"
  | "income"
  | "category"
  | "one_off_obligation"
  | "recurring";

export type AddActionIconName =
  | "ArrowDownCircle"
  | "ArrowUpCircle"
  | "Tag"
  | "CalendarClock"
  | "CalendarCheck"
  | "Repeat"
  | "RefreshCw";

export type AddActionMeta = {
  key: AddActionKey;
  title: string;
  description: string;
  icon: AddActionIconName;
  iconFallback?: AddActionIconName;
};

export const ADD_ACTIONS: AddActionMeta[] = [
  {
    key: "expense",
    title: "Añadir gasto",
    description: "Registra un pago del día a día.",
    icon: "ArrowDownCircle",
  },
  {
    key: "income",
    title: "Añadir ingreso",
    description: "Suma un ingreso a tu mes.",
    icon: "ArrowUpCircle",
  },
  {
    key: "category",
    title: "Añadir categoría",
    description: "Crea o actualiza categorías compartidas.",
    icon: "Tag",
  },
  {
    key: "one_off_obligation",
    title: "Añadir obligación (pago único)",
    description: "Un pago único con fecha de vencimiento.",
    icon: "CalendarClock",
    iconFallback: "CalendarCheck",
  },
  {
    key: "recurring",
    title: "Añadir recurrente",
    description:
      "Una serie que crea ocurrencias; confirma cada una para registrar.",
    icon: "Repeat",
    iconFallback: "RefreshCw",
  },
];

export const getAddAction = (key: AddActionKey) =>
  ADD_ACTIONS.find((action) => action.key === key);
