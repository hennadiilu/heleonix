import type { IThemeGroup } from "./IThemeGroup"
import { THEME_ENTRY_SEPARATOR } from "../names/THEME_ENTRY_SEPARATOR"

export function flattenThemeTokens(groups: IThemeGroup, prefix = ""): Record<string, string> {
  const tokens: Record<string, string> = {}

  for (const name of Object.keys(groups)) {
    const node = groups[name]
    const path = prefix === "" ? name : `${prefix}${THEME_ENTRY_SEPARATOR}${name}`

    if (typeof node === "string") {
      tokens[path] = node
    } else {
      Object.assign(tokens, flattenThemeTokens(node, path))
    }
  }

  return tokens
}
