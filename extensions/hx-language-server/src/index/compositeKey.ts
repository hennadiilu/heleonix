/**
 * Joins two name parts into one map key for the flat reverse-usage tables
 * (dictionary/config name + entry, component + control name). Uses NUL, which
 * can never occur in a Heleonix identifier, so the parts stay unambiguous
 * without a nested map and merge through the same helpers as the other tables.
 */
const SEP = "\u0000"

export function compositeKey(left: string, right: string): string {
  return `${left}${SEP}${right}`
}

/** Splits a {@link compositeKey} back into its two parts. */
export function splitCompositeKey(key: string): [string, string] {
  const at = key.indexOf(SEP)

  return at < 0 ? [key, ""] : [key.slice(0, at), key.slice(at + 1)]
}
