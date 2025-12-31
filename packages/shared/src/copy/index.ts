import { en } from "./locales/en";

export { getDictionary, t, pluralize, formatParticipantCount } from "./helpers";
export type { CopyParams, PluralForms } from "./types";
export type CopyDictionary = typeof en;
export type CopyKey = import("./types").LeafKeys<CopyDictionary>;
