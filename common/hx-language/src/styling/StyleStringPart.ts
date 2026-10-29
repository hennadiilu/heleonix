export type StyleStringPart =
  | { readonly kind: "raw"; readonly text: string }
  | { readonly kind: "binding"; readonly source: string }
