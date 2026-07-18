/**
 * A raw text run between tags, with its absolute offsets, as produced by the
 * error-tolerant {@link scanXml} lexer. Unlike {@link IXmlText} (a decoded tree
 * node), the value here is the verbatim source slice; entity decoding and
 * trimming are the consumer's concern.
 */
export interface IXmlTextRun {
  value: string

  start: number

  end: number

  /** `true` when the run is the verbatim content of a `<![CDATA[ ... ]]>` section. */
  cdata?: boolean
}
