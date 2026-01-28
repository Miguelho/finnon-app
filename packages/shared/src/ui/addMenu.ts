export type AddActionKey = "movement" | "recurring";

export type AddActionIconName =
  | "PlusCircle"
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
    key: "movement",
    title: "Añadir movimiento",
    description: "Registra un ingreso, gasto u obligación.",
    icon: "PlusCircle",
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
