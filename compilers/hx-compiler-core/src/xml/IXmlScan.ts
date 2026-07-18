import { IXmlComment } from "./IXmlComment"
import { IXmlTag } from "./IXmlTag"
import { IXmlTextRun } from "./IXmlTextRun"

/**
 * Result of an error-tolerant, single-pass scan of XML-like source: every tag
 * occurrence, every text run and every comment, with absolute offsets. The
 * scan never throws; strict structural validation is layered on top by
 * {@link parseXml}.
 */
export interface IXmlScan {
  tags: IXmlTag[]

  texts: IXmlTextRun[]

  comments: IXmlComment[]
}
