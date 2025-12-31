export type CopyParams = Record<string, string | number>;

export type PluralForms = {
  one: string;
  other: string;
  zero?: string;
};

export type CopyValue = string | PluralForms | CopyRecord;

export type CopyRecord = {
  [key: string]: CopyValue;
};

type Join<Prefix extends string, Key extends string> = Prefix extends ""
  ? Key
  : `${Prefix}.${Key}`;

export type LeafKeys<T, Prefix extends string = ""> = T extends string
  ? Prefix
  : T extends PluralForms
  ? Prefix
  : T extends Record<string, CopyValue>
  ? {
      [Key in Extract<keyof T, string>]: LeafKeys<
        T[Key],
        Join<Prefix, Key>
      >;
    }[Extract<keyof T, string>]
  : never;
