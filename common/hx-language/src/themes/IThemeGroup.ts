import type { IThemeNode } from "./IThemeNode"

/**
 * A theme token group: a map of names to child groups or leaf token values. The
 * structure is entirely consumer-defined - the framework attaches no meaning to
 * any name and hardcodes none.
 */
export interface IThemeGroup {
  [name: string]: IThemeNode
}
