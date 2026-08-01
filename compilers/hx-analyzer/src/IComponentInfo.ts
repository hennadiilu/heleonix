import type { IMemberType } from "./IMemberType"

/**
 * A component known to the analyzer, for editor features (tag/prop completion,
 * hover, go-to-implementation). Covers `*.hxm`, native elements and programmatic
 * components alike: `members` are the resolved props/events, `open` marks
 * components that also accept attributes beyond that set (native elements:
 * `class`, `data-*`, ...). `file`/`line`/`character` locate a programmatic
 * component's class for go-to-implementation (absent for `*.hxm`/native/meta).
 */
export interface IComponentInfo {
  name: string

  docs?: string

  open: boolean

  members: IMemberType[]

  file?: string

  line?: number

  character?: number
}
