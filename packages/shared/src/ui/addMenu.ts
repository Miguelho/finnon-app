export type AddActionKey = "movement" | "recurring" | "category";

export type AddActionIconName =
  | "PlusCircle"
  | "Repeat"
  | "RefreshCw"
  | "Tag";

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
  {
    key: "category",
    title: "Crear categoría",
    description: "Crea o actualiza categorías compartidas.",
    icon: "Tag",
  },
];

export const getAddAction = (key: AddActionKey) =>
  ADD_ACTIONS.find((action) => action.key === key);
