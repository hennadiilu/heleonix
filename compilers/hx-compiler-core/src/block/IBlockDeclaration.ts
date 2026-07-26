/**
 * A `name: value;` declaration in the CSS-subset grammar - a CSS declaration in
 * `*.hxs` or a token in `*.hxt`. `value` is raw text with `{...}` interpolations
 * left intact; the compiler keeps them as binding-source placeholders.
 */
export interface IBlockDeclaration {
  kind: "declaration"

  name: string

  value: string

  /** Raw `/** ... *\/` doc comment immediately preceding the declaration, if any. */
  doc?: string
}
