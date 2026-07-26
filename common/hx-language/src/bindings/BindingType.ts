/**
 * `literal` sources keep valid JSON in `value`, so consumers coerce it with one
 * `JSON.parse`: booleans/numbers keep their raw text; a single-quoted string
 * literal (`'primary'`) is normalized to its JSON form (`"primary"`). Bare
 * unquoted strings are always references, never literals.
 *
 * `theme` is a style-only source (`{$Theme.token}` in `*.hxs`/`*.hxt`); it never
 * appears in `*.hxm` attribute bindings, but the grammar is shared so the same
 * parser serves styles, analyzer and LSP.
 */
export type BindingType = "state" | "dictionary" | "config" | "theme" | "literal"
