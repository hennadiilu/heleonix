import type { IStyleDeclarations } from "./IStyleDeclarations"
import type { IDimension } from "../dimensions/IDimension"
import type { DimensionUsage } from "../dimensions/DimensionUsage"

/**
 * Compiled `*.hxs` style: platform-neutral data. Rules are keyed by a canonical
 * qualifier signature (`""` root, `Hover`, `Media(query:...)`, `If(...)`,
 * `Style(for:...)`, `&`-joined for AND) so dimension overlays deep-merge
 * per-declaration like dictionaries/configs. No CSS text, selectors or vendor
 * prefixes appear - platform codegen turns this into actual styling.
 */
export interface IStyleDefinition {
  name: string

  dimension: IDimension

  usage?: DimensionUsage

  /** Signature -> declarations. */
  rules: Record<string, IStyleDeclarations>

  /** Component-local timeline name -> frame selector (`from`/`to`/`50%`) -> declarations. */
  keyframes?: Record<string, Record<string, IStyleDeclarations>>

  /** Signature -> theme token paths applied via `@hx-apply`, in document order (expanded by platform codegen). */
  applies?: Record<string, string[]>
}
