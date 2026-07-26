const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/

/**
 * Whether a binding source is an inline literal: `true`, `false` or a number.
 * Only booleans and numbers may be literal - their type cannot carry content.
 * Strings are always references (`@` dictionary, `#` config, `%` constant).
 * Literal text is valid JSON, so consumers coerce it with one `JSON.parse`.
 */
export function isLiteralSource(source: string): boolean {
  return source === "true" || source === "false" || NUMBER.test(source)
}
