import type { IThemeGroup } from "./IThemeGroup"
import type { IThemeNode } from "./IThemeNode"
import { THEME_ENTRY_SEPARATOR } from "../names/THEME_ENTRY_SEPARATOR"

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
