import type { IQualifierUsage } from "./IQualifierUsage"

/**
 * Serializes a single qualifier segment to its canonical form: `Name` with no
 * arguments, `Name(pos)` for a positional pseudo argument, or `Name(a:x,b:y)`
 * with named arguments sorted by name.
 */
export function stringifyQualifierUsage(usage: IQualifierUsage): string {
  const names = Object.keys(usage.args)

  if (names.length === 0) {
    return usage.positional !== undefined ? `${usage.name}(${usage.positional})` : usage.name
  }

  const args = names
    .sort()
    .map((name) => `${name}:${usage.args[name]}`)
    .join(",")

  return `${usage.name}(${args})`
}
