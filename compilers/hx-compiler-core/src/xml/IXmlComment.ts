/**
 * A comment occurrence collected by {@link scanXml}. `value` is the verbatim
 * text between `<!--` and `-->` (a doc comment when it starts with `*`, i.e.
 * `<!--* ... -->`); offsets span the whole comment including its markers.
 */
export interface IXmlComment {
  value: string

  /** Offset of the `<` of `<!--`. */
  start: number

  /** Offset just past `-->` (end of input when unterminated). */
  end: number
}
