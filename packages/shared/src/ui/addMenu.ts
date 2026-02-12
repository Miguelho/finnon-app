export type AddActionKey = "movement" | "recurring" | "category";

export type AddActionIconName =
  | "PlusCircle"
  | "Repeat"
  | "RefreshCw"
  | "Tag";

export type AddActionMeta = {
  key: AddActionKey;
  titleKey: string;
  descriptionKey: string;
  icon: AddActionIconName;
  iconFallback?: AddActionIconName;
};

export const ADD_ACTIONS: AddActionMeta[] = [
  {
    key: "movement",
    titleKey: "addTransaction.entryTitle",
    descriptionKey: "transactions.create.description",
    icon: "PlusCircle",
  },
  {
    key: "recurring",
    titleKey: "home.addRecurringTitle",
    descriptionKey: "home.addRecurringDescription",
    icon: "Repeat",
    iconFallback: "RefreshCw",
  },
  {
    key: "category",
    titleKey: "home.addCategoryTitle",
    descriptionKey: "home.addCategoryDescription",
    icon: "Tag",
  },
];

export const getAddAction = (key: AddActionKey) =>
  ADD_ACTIONS.find((action) => action.key === key);
