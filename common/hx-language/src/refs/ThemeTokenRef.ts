declare const themeTokenRefBrand: unique symbol

/**
 * Branded argument type for a style qualifier: the argument's value is a
 * `{$Theme.token}` reference. The analyzer detects the brand and routes value
 * completion/validation to the theme token space (the same provider that backs
 * `{$...}` completion in `*.hxs`/`*.hxt`).
 *
 * Type-only marker - authored in a qualifier's args interface, never
 * instantiated; the compiled rule key keeps the source text verbatim.
 */
export type ThemeTokenRef = string & { readonly [themeTokenRefBrand]: "ThemeTokenRef" }
