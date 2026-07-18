import { IXmlElement } from "./IXmlElement"
import { IXmlError } from "./IXmlError"

/**
 * Output of the error-tolerant {@link parseXml}: a best-effort root element
 * (absent only when the source contains no element at all) and every structural
 * or lexical error encountered, in document order.
 */
export interface IXmlParseResult {
  root?: IXmlElement

  errors: IXmlError[]
}
