import type { StyleStringPart } from "./StyleStringPart"

export type StyleValueToken =
  | StyleStringPart
  | { readonly kind: "string"; readonly quote: string; readonly parts: readonly StyleStringPart[] }
