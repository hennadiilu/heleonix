import { IXmlNode } from "./IXmlNode"

export interface IXmlElement {
  type: "element"

  tag: string

  attributes: Record<string, string>

  children: IXmlNode[]

  start: number
}
