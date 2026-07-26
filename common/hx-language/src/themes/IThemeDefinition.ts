import type { IThemeGroup } from "./IThemeGroup"
import type { IStyleDeclarations } from "../styles/IStyleDeclarations"
import type { IDimension } from "../dimensions/IDimension"
import type { DimensionUsage } from "../dimensions/DimensionUsage"

/**
 * Compiled `*.hxt` theme partial. A theme is one arbitrary token tree (`groups`)
 * plus the well-known CSS `@`-artifacts, kept beside it. `{$...}` aliases and
 * `{prop}` interpolations stay as text; the runtime provider merges partials
 * across dimensions/sources into the single application theme.
 */
export interface IThemeDefinition {
  name: string

  dimension: IDimension

  usage?: DimensionUsage

  /** Arbitrary, consumer-defined token tree: groups nesting groups and leaf tokens. */
  groups: IThemeGroup

  /** `@keyframes`: timeline name -> frame selector (`from`/`to`/`50%`/`from, to`) -> declarations. */
  keyframes?: Record<string, Record<string, IStyleDeclarations>>

  /** `@font-face`: one descriptor map per registration (fonts have no name key). */
  fontFaces?: IStyleDeclarations[]

  /** `@counter-style`: counter name -> descriptors. */
  counterStyles?: Record<string, IStyleDeclarations>
}
