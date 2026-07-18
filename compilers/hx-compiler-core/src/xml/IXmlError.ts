import { IErrorInfo } from "../errors/IErrorInfo"

/**
 * A structural or lexical problem found while building the XML tree in
 * {@link parseXml}. Carries the error descriptor plus its message arguments and
 * the source offset, so the strict {@link XmlParser} wrapper can raise a
 * {@link HeleonixCompilerError} while editor tooling can map it to a range.
 */
export interface IXmlError {
  info: IErrorInfo

  /** Arguments for {@link IErrorInfo.message}'s positional placeholders. */
  args: string[]

  /** Zero-based source offset where the problem was detected. */
  offset: number
}
