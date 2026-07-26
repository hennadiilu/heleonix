import type { IThemeGroup } from "./IThemeGroup"
import type { IThemeNode } from "./IThemeNode"
import { THEME_ENTRY_SEPARATOR } from "../names/THEME_ENTRY_SEPARATOR"

/**
 * Resolves a dot-path (`Typography.Heading`, `Palette.Blue.t60`) against a theme
 * token tree to the node it addresses - a leaf value (string) or a nested group -
 * or `undefined` when any segment is missing or descends through a leaf. Shared
 * by `{$...}` reference resolution and `@hx-apply` group expansion.
 */
export function resolveThemeNode(groups: IThemeGroup, path: string): IThemeNode | undefined {
  let node: IThemeNode | undefined = groups

  for (const segment of path.split(THEME_ENTRY_SEPARATOR)) {
    if (typeof node !== "object") {
      return undefined
    }

    node = node[segment]
  }

  return node
}
