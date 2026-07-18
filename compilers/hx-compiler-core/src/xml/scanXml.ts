import { IXmlAttribute } from "./IXmlAttribute"
import { IXmlComment } from "./IXmlComment"
import { IXmlScan } from "./IXmlScan"
import { IXmlTag } from "./IXmlTag"
import { IXmlTextRun } from "./IXmlTextRun"

/**
 * Error-tolerant, single-pass lexer for XML-like Heleonix source.
 *
 * Unlike a strict XML parser (which throws on the first problem), this scanner
 * never throws: it walks the text once and reports the structural spans both the
 * build pipeline and editor tooling need - tag occurrences (name + attribute
 * ranges), text runs and comments (`<!-- ... -->`, collected so doc comments
 * can be associated with the node they precede) - with absolute character
 * offsets. Processing instructions/declarations are skipped; CDATA sections
 * are emitted as verbatim text runs.
 *
 * {@link parseXml} layers strict tree-building and validation on top of this,
 * while the language server consumes the flat scan directly for diagnostics and
 * semantic tokens - so there is a single source of truth for the grammar.
 */

const LT = 60 // <
const GT = 62 // >
const SLASH = 47 // /
const EQ = 61 // =
const DQUOTE = 34 // "
const SQUOTE = 39 // '
const BANG = 33 // !
const QUESTION = 63 // ?

function isSpace(c: number): boolean {
  return c === 32 || c === 9 || c === 10 || c === 13
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

    // A '<' begins a tag/comment/section - close out any pending text run.
    flushText(pos)

    // Comment: <!-- ... -->
    if (text.startsWith("<!--", pos)) {
      const end = text.indexOf("-->", pos + 4)
      const next = end === -1 ? len : end + 3
      comments.push({ value: text.slice(pos + 4, end === -1 ? len : end), start: pos, end: next })
      pos = next
      textStart = pos
      continue
    }

    // CDATA: <![CDATA[ ... ]]> - emitted verbatim, may contain '<' and '>'.
    if (text.startsWith("<![CDATA[", pos)) {
      const inner = pos + 9 // '<![CDATA['.length
      const end = text.indexOf("]]>", inner)
      const close = end === -1 ? len : end

      if (close > inner) {
        texts.push({ value: text.slice(inner, close), start: inner, end: close, cdata: true })
      }

      pos = end === -1 ? len : end + 3
      textStart = pos
      continue
    }

    // Other declarations / processing instructions: skip to '>'.
    if (text.charCodeAt(pos + 1) === BANG || text.charCodeAt(pos + 1) === QUESTION) {
      const end = text.indexOf(">", pos + 1)
      pos = end === -1 ? len : end + 1
      textStart = pos
      continue
    }

    const tag = readTag(text, pos, len)

    if (!tag) {
      // Not actually a tag (e.g. a stray '<') - treat '<' as text.
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
  let pos = start + 1 // consume '<'
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

  // Attributes up to the closing '>' (noting a trailing '/').
  while (pos < len) {
    const c = text.charCodeAt(pos)

    if (c === SLASH) {
      // The only legal '/' in a start tag is the self-close; attribute values
      // are consumed inside readAttr, so a bare '/' here means '<Tag ... />'.
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

    if (!isNameChar(c)) {
      // Unexpected char - skip it so we stay error-tolerant.
      pos++
      continue
    }

    const attr = readAttr(text, pos, len)
    tag.attrs.push(attr.attr)
    pos = attr.next

    if (pos > len) {
      break
    }
  }

  return { tag, next: pos }
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
  }

  // Skip whitespace before a possible '='.
  while (pos < len && isSpace(text.charCodeAt(pos))) {
    pos++
  }

  if (text.charCodeAt(pos) !== EQ) {
    return { attr, next: pos }
  }

  pos++ // consume '='

  while (pos < len && isSpace(text.charCodeAt(pos))) {
    pos++
  }

  const quote = text.charCodeAt(pos)

  if (quote !== DQUOTE && quote !== SQUOTE) {
    // '=' present but no quoted value - structurally invalid.
    attr.malformed = true
    return { attr, next: pos }
  }

  pos++ // consume opening quote
  const valueStart = pos

  while (pos < len && text.charCodeAt(pos) !== quote) {
    pos++
  }

  attr.valueStart = valueStart
  attr.valueEnd = pos
  attr.value = text.slice(valueStart, pos)

  if (pos < len) {
    pos++ // consume closing quote
  } else {
    attr.unterminated = true
  }

  return { attr, next: pos }
}
