import type { XmlAttributeKind } from "./XmlAttributeKind"

export interface IXmlAttributeValue {
  kind: XmlAttributeKind

  value: string
}
