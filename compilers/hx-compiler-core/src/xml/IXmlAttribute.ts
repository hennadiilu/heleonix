import type { XmlAttributeKind } from "./XmlAttributeKind"

export interface IXmlAttribute {
  name: string

  nameStart: number

  nameEnd: number

  kind: XmlAttributeKind

  valueStart?: number

  valueEnd?: number

  value?: string

  shorthand?: boolean

  unterminated?: boolean

  malformed?: boolean
}
