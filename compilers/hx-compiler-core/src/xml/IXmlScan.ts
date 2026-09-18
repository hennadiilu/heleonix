import { IXmlComment } from "./IXmlComment"
import { IXmlTag } from "./IXmlTag"
import { IXmlTextRun } from "./IXmlTextRun"

export interface IXmlScan {
  tags: IXmlTag[]

  texts: IXmlTextRun[]

  comments: IXmlComment[]
}
