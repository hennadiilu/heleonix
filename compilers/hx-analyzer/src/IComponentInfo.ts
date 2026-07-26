import type { IMemberType } from "./IMemberType"

/**
 * A component known to the analyzer, for editor features (tag/prop completion
 * and hover). Covers workspace components and native elements alike: `members`
 * are the resolved props/events, `open` marks components that also accept
 * attributes beyond that set (native elements: `class`, `data-*`, ...).
 */
export interface IComponentInfo {
  name: string

  docs?: string

  open: boolean

  members: IMemberType[]
}
