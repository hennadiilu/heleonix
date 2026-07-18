/**
 * A single attribute parsed from a start tag, with absolute character offsets
 * for the name and (optional) quoted value. Produced by the error-tolerant
 * {@link scanXml} lexer; consumed both by editor tooling (for ranges) and by
 * {@link parseXml} (to build the strict attribute map).
 */
export interface IXmlAttribute {
  name: string

  nameStart: number

  nameEnd: number

  /** Offset of the first character inside the quotes (undefined for value-less attrs). */
  valueStart?: number

  valueEnd?: number

  value?: string

  /** `true` when the opening quote was never closed before end-of-file. */
  unterminated?: boolean

  /** `true` when an `=` was present but no quoted value followed it. */
  malformed?: boolean
}
