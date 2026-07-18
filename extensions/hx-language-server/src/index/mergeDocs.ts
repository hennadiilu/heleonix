import { IDocs } from "@heleonix/hx-language"

/**
 * Merges two docs of the same symbol (e.g. contributed by different dimension
 * files or sources): `first`'s scalar fields win, record fields are unioned
 * with `first`'s keys taking precedence.
 */
export function mergeDocs(first: IDocs, second: IDocs): IDocs {
  const result: IDocs = { ...second, ...first }

  mergeField(result, "props", first, second)
  mergeField(result, "params", first, second)
  mergeField(result, "entries", first, second)

  return result
}

function mergeField<K extends "props" | "params" | "entries">(
  result: IDocs,
  key: K,
  first: IDocs,
  second: IDocs,
): void {
  if (first[key] || second[key]) {
    result[key] = { ...second[key], ...first[key] }
  }
}
