import { IXmlElement } from "./IXmlElement"
import { IXmlError } from "./IXmlError"

export interface IXmlParseResult {
  root?: IXmlElement

  errors: IXmlError[]
}
