/**
 * A `;`-terminated construct with no top-level `:` and no block body, e.g.
 * `@hx-apply(token: Type.Body)`. Distinct from a declaration (which has a
 * top-level `name:`) - the compiler dispatches on the leading `@`-word.
 */
export interface IBlockStatement {
  kind: "statement"

  text: string

  /** Raw `/** ... *\/` doc comment immediately preceding the statement, if any. */
  doc?: string
}
