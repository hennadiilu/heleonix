/**
 * Whether a binding source is an inline string literal: a single-quoted token
 * such as `'primary'`. String literals carry a value whose kind (string) cannot
 * be inferred otherwise, so they are only meaningful where a vocabulary or
 * `string` type is declared - the analyzer type-checks them like `%` members.
 * A single-quoted token with an interior quote (`'a'b'`) is not a literal.
 */
export function isStringLiteralSource(source: string): boolean {
  return (
    source.length >= 2 &&
    source.charAt(0) === "'" &&
    source.charAt(source.length - 1) === "'" &&
    source.indexOf("'", 1) === source.length - 1
  )
}
