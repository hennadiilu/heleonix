import type { IMemberType } from "./IMemberType"

/**
 * A programmatic component found by the analyzer's class scan (a class extending
 * `Component<TProps, TEvents>`). Its tag is the class name verbatim (no suffix,
 * unlike converters/actions/qualifiers); `props` and `events` are the resolved
 * members of the two contract type arguments, so usages validate and complete
 * exactly like a `*.hxm` component's frontmatter.
 */
export interface IDiscoveredComponent {
  name: string

  file: string

  /** Zero-based line/character of the class name, for go-to-implementation. */
  line: number

  character: number

  /** The class's summary doc comment, if any. */
  docs?: string

  props: IMemberType[]

  events: IMemberType[]
}
