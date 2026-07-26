import type { IThemeGroup } from "./IThemeGroup"

/**
 * A node in the theme token tree: either a leaf token value (raw CSS text with
 * `{$...}` aliases / `{prop}` interpolations kept intact) or a nested group.
 */
export type IThemeNode = string | IThemeGroup
