import { IXmlAttribute } from "./IXmlAttribute"

/**
 * A tag occurrence (`<Tag ...>`, `<Tag ... />` or `</Tag>`) found by
 * {@link scanXml}, with the tag name's offsets and its parsed attributes.
 */
export interface IXmlTag {
  /** `true` when this is a closing tag (`</Tag>`). */
  closing: boolean

  /** `true` when this is a self-closing start tag (`<Tag />`). */
  selfClosing: boolean

  name: string

  /** Offset of the tag name's first character. */
  nameStart: number

  nameEnd: number

  attrs: IXmlAttribute[]
}
