/**
 * One qualifier segment of a compiled style rule key, e.g. `Hover`,
 * `Media(query:...)`, `If(is:{'primary'},value:{variant})`, `NthChild(2n+1)`.
 * A rule key is an `&`-joined list of these (nesting = AND); the root rule (`""`)
 * has an empty list.
 */
export interface IQualifierUsage {
  /** Segment name, e.g. `Hover`, `Media`, `If`, `Style`, `NthChild`. */
  name: string

  /**
   * Named arguments keyed by name, values kept verbatim (a `{...}` binding
   * source, a literal, or opaque CSS text): `{ value: "{variant}", is: "{'primary'}" }`.
   */
  args: Record<string, string>

  /**
   * Positional argument of a native functional pseudo, passed through as written
   * (`NthChild(2n+1)` -> `2n+1`, `Not(:hover)` -> `:hover`, `Is(.a,.b)` -> `.a,.b`).
   * Mutually exclusive with named `args`.
   */
  positional?: string
}
