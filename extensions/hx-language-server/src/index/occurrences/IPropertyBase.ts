export type IPropertyBase =
  | { source: "components"; components: string[] }
  | { source: "dictionaryReferrers"; name: string; entry: string }
