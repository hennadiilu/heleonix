import type { IDimension } from "../dimensions/IDimension"
import type { IMemberType } from "../members/IMemberType"

/**
 * Compile-time facts of one component shipped in `hx.meta.json`, per dimension
 * file: its resolved props/events member contracts and summary docs. The props
 * and events TypeScript types are resolved to member facts at the producing
 * package's build time - mirroring converter/action entries - so a consuming
 * package validates usages without re-resolving the library's TypeScript
 * sources (whose internal type imports it cannot see).
 */
export interface IComponentMetaEntry {
  name: string

  dimension: IDimension

  docs?: string

  props?: IMemberType[]

  events?: IMemberType[]

  /**
   * The component's control names (every `name`d control in its definition
   * tree). Ships so a consumer can validate `@hx-style(for: ...)` scope paths
   * over this component even though its `*.hxm` is not in the consumer's
   * workspace - the same provenance-agnostic delivery as props/events.
   */
  controls?: string[]

  /**
   * Whether the component accepts attributes beyond its enumerated contract
   * (native HTML elements: `class`, `data-*`, `aria-*`, ...). Open components
   * value-check their known members but do not report unknown attributes.
   */
  open?: boolean
}
