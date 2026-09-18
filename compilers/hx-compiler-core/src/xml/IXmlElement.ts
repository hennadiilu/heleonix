import { IXmlAttributeValue } from "./IXmlAttributeValue"
import { IXmlNode } from "./IXmlNode"

export interface IXmlElement {
  type: "element"

  tag: string

  attributes: Record<string, IXmlAttributeValue>

  children: IXmlNode[]

  start: number
}
