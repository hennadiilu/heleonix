import { IXmlAttribute } from "./IXmlAttribute"

export interface IXmlTag {
  closing: boolean

  selfClosing: boolean

  name: string

  nameStart: number

  nameEnd: number

  attrs: IXmlAttribute[]
}
