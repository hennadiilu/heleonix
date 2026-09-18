import type { IQualifierUsage } from "./IQualifierUsage"

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
