import { IXmlAttribute } from "./IXmlAttribute"
import { IXmlComment } from "./IXmlComment"
import { IXmlScan } from "./IXmlScan"
import { IXmlTag } from "./IXmlTag"
import { IXmlTextRun } from "./IXmlTextRun"

const LT = 60
const GT = 62
const SLASH = 47
const EQ = 61
const DQUOTE = 34
const SQUOTE = 39
const BANG = 33
const QUESTION = 63
const LBRACE = 123
const RBRACE = 125

function isSpace(c: number): boolean {
  return c === 32 || c === 9 || c === 10 || c === 13
}

function isQuote(c: number): boolean {
  return c === DQUOTE || c === SQUOTE
}

function isNameChar(c: number): boolean {
  // Letters, digits, and the separators Heleonix uses in tags/attrs: . : - _
  return (
    (c >= 65 && c <= 90) ||
    (c >= 97 && c <= 122) ||
    (c >= 48 && c <= 57) ||
    c === 46 ||
    c === 58 ||
    c === 45 ||
    c === 95
  )
}

export function scanXml(text: string): IXmlScan {
  const len = text.length
  const tags: IXmlTag[] = []
  const texts: IXmlTextRun[] = []
  const comments: IXmlComment[] = []

  let pos = 0
  let textStart = 0

  const flushText = (end: number): void => {
    if (end <= textStart) {
      return
    }

    const raw = text.slice(textStart, end)

    if (raw.trim()) {
      texts.push({ value: raw, start: textStart, end })
    }
  }

  while (pos < len) {
    if (text.charCodeAt(pos) !== LT) {
      pos++
      continue
    }

    flushText(pos)

    if (text.startsWith("<!--", pos)) {
      const end = text.indexOf("-->", pos + 4)
      const next = end === -1 ? len : end + 3
      comments.push({ value: text.slice(pos + 4, end === -1 ? len : end), start: pos, end: next })
      pos = next
      textStart = pos
      continue
    }

    if (text.startsWith("<![CDATA[", pos)) {
      const inner = pos + 9
      const end = text.indexOf("]]>", inner)
      const close = end === -1 ? len : end

      if (close > inner) {
        texts.push({ value: text.slice(inner, close), start: inner, end: close, cdata: true })
      }

      pos = end === -1 ? len : end + 3
      textStart = pos
      continue
    }

    if (text.charCodeAt(pos + 1) === BANG || text.charCodeAt(pos + 1) === QUESTION) {
      const end = text.indexOf(">", pos + 1)
      pos = end === -1 ? len : end + 1
      textStart = pos
      continue
    }

    const tag = readTag(text, pos, len)

    if (!tag) {
      pos++
      continue
    }

    tags.push(tag.tag)
    pos = tag.next
    textStart = pos
  }

  flushText(len)

  return { tags, texts, comments }
}

function readTag(text: string, start: number, len: number): { tag: IXmlTag; next: number } | undefined {
  let pos = start + 1
  const closing = text.charCodeAt(pos) === SLASH

  if (closing) {
    pos++
  }

  const nameStart = pos

  while (pos < len && isNameChar(text.charCodeAt(pos))) {
    pos++
  }

  if (pos === nameStart) {
    return undefined
  }

  const tag: IXmlTag = {
    closing,
    selfClosing: false,
    name: text.slice(nameStart, pos),
    nameStart,
    nameEnd: pos,
    attrs: [],
  }

  while (pos < len) {
    const c = text.charCodeAt(pos)

    if (c === SLASH) {
      // Attribute values are consumed inside readAttr, so a bare slash here is
      // the self-close of the tag.
      tag.selfClosing = true
      pos++
      continue
    }

    if (isSpace(c)) {
      pos++
      continue
    }

    if (c === GT) {
      pos++
      break
    }

    if (c !== LBRACE && !isNameChar(c)) {
      // Unexpected char - skip it so we stay error-tolerant.
      pos++
      continue
    }

    const attr = c === LBRACE ? readShorthandAttr(text, pos, len) : readAttr(text, pos, len)
    tag.attrs.push(attr.attr)
    pos = attr.next

    if (pos > len) {
      break
    }
  }

  return { tag, next: pos }
}

interface IBracedValue {
  valueStart: number
  valueEnd: number
  next: number
  unterminated: boolean
}

function readBraced(text: string, start: number, len: number): IBracedValue {
  let pos = start + 1
  const valueStart = pos
  let depth = 1

  while (pos < len) {
    const c = text.charCodeAt(pos)

    if (isQuote(c)) {
      pos++

      while (pos < len && text.charCodeAt(pos) !== c) {
        pos++
      }

      if (pos < len) {
        pos++
      }

      continue
    }

    if (c === LBRACE) {
      depth++
    } else if (c === RBRACE) {
      depth--

      if (depth === 0) {
        return { valueStart, valueEnd: pos, next: pos + 1, unterminated: false }
      }
    }

    pos++
  }

  return { valueStart, valueEnd: len, next: len, unterminated: true }
}

function readShorthandAttr(text: string, start: number, len: number): { attr: IXmlAttribute; next: number } {
  const braced = readBraced(text, start, len)
  const value = text.slice(braced.valueStart, braced.valueEnd)
  const nameStart = braced.valueStart + (value.length - value.trimStart().length)

  let nameEnd = nameStart

  while (nameEnd < braced.valueEnd && isNameChar(text.charCodeAt(nameEnd))) {
    nameEnd++
  }

  const attr: IXmlAttribute = {
    name: text.slice(nameStart, nameEnd),
    nameStart,
    nameEnd,
    kind: "expression",
    shorthand: true,
    valueStart: braced.valueStart,
    valueEnd: braced.valueEnd,
    value,
  }

  if (braced.unterminated) {
    attr.unterminated = true
  }

  return { attr, next: braced.next }
}

function readAttr(text: string, start: number, len: number): { attr: IXmlAttribute; next: number } {
  let pos = start
  const nameStart = pos

  while (pos < len && isNameChar(text.charCodeAt(pos))) {
    pos++
  }

  const attr: IXmlAttribute = {
    name: text.slice(nameStart, pos),
    nameStart,
    nameEnd: pos,
    kind: "flag",
  }

  const afterName = pos

  while (pos < len && isSpace(text.charCodeAt(pos))) {
    pos++
  }

  if (text.charCodeAt(pos) !== EQ) {
    // No assignment: a value-less flag. Rewind to just after the name so the
    // tag loop re-reads what follows and can end the tag on it.
    return { attr, next: afterName }
  }

  pos++

  while (pos < len && isSpace(text.charCodeAt(pos))) {
    pos++
  }

  const c = text.charCodeAt(pos)

  if (c === LBRACE) {
    const braced = readBraced(text, pos, len)

    attr.kind = "expression"
    attr.valueStart = braced.valueStart
    attr.valueEnd = braced.valueEnd
    attr.value = text.slice(braced.valueStart, braced.valueEnd)

    if (braced.unterminated) {
      attr.unterminated = true
    }

    return { attr, next: braced.next }
  }

  if (!isQuote(c)) {
    // Assignment present but no quoted or braced value - structurally invalid.
    attr.malformed = true

    return { attr, next: pos }
  }

  pos++
  const valueStart = pos

  while (pos < len && text.charCodeAt(pos) !== c) {
    pos++
  }

  attr.kind = "literal"
  attr.valueStart = valueStart
  attr.valueEnd = pos
  attr.value = text.slice(valueStart, pos)

  if (pos < len) {
    pos++
  } else {
    attr.unterminated = true
  }

  return { attr, next: pos }
}
