/**
 * A block comment occurrence collected by {@link parseJsonc}. `value` is the
 * verbatim text between `/*` and `*\/` (a doc comment when it starts with `*`,
 * i.e. `/** ... *\/`); offsets span the whole comment including its markers.
 * Line comments are not collected - they cannot be doc comments.
 */
export interface IJsoncComment {
  value: string

  /** Offset of the `/` of `/*`. */
  start: number

  /** Offset just past `*\/`. */
  end: number
}
