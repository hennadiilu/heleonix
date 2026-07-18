import { Errors } from "../errors/Errors"
import { IErrorInfo } from "../errors/IErrorInfo"
import { IXmlElement } from "./IXmlElement"
import { IXmlError } from "./IXmlError"
import { IXmlParseResult } from "./IXmlParseResult"
import { IXmlTag } from "./IXmlTag"
import { IXmlTextRun } from "./IXmlTextRun"
import { scanXml } from "./scanXml"

const CC_HASH = 35
const CC_X_LOWER = 120
const CC_X_UPPER = 88

/**
 * Error-tolerant XML tree builder layered on top of {@link scanXml}.
 *
 * It walks the flat scan once, assembling the nested {@link IXmlElement} tree the
 * compilers consume, and collects every structural/lexical problem (mismatched
 * or unclosed tags, multiple roots, invalid attributes) into `errors` in
 * document order rather than throwing. Attribute values and text are
 * entity-decoded here; CDATA runs are kept verbatim. The strict
 * {@link XmlParser} wraps this and fails when `errors` is non-empty.
 */
export function parseXml(source: string): IXmlParseResult {
  const scan = scanXml(source)
  const errors: IXmlError[] = []
  const roots: IXmlElement[] = []
  const stack: IXmlElement[] = []

  const addError = (info: IErrorInfo, args: string[], offset: number): void => {
    errors.push({ info, args, offset })
  }

  const appendChild = (node: IXmlElement["children"][number]): void => {
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node)
    }
    // Top-level text/whitespace is not part of the tree and is dropped.
  }

  let ti = 0
  let xi = 0

  while (ti < scan.tags.length || xi < scan.texts.length) {
    const tag = ti < scan.tags.length ? scan.tags[ti] : undefined
    const text = xi < scan.texts.length ? scan.texts[xi] : undefined

    if (text && (!tag || text.start < tag.nameStart)) {
      appendText(text, stack, appendChild)
      xi++
      continue
    }

    handleTag(tag as IXmlTag, stack, roots, errors, addError)
    ti++
  }

  // Anything left open at end-of-input is unclosed; report innermost first to
  // match the order a single-pass strict parser would hit them.
  for (let i = stack.length - 1; i >= 0; i--) {
    const open = stack[i]
    addError(Errors.xmlUnclosedTag, [open.tag, String(open.start)], open.start)
  }

  return { root: roots[0], errors }
}

function appendText(
  run: IXmlTextRun,
  stack: IXmlElement[],
  appendChild: (node: IXmlElement["children"][number]) => void,
): void {
  if (stack.length === 0) {
    return
  }

  if (run.cdata) {
    appendChild({ type: "text", value: run.value, start: run.start })
    return
  }

  const trimmed = run.value.trim()

  if (trimmed) {
    appendChild({ type: "text", value: decodeEntities(trimmed), start: run.start })
  }
}

function handleTag(
  tag: IXmlTag,
  stack: IXmlElement[],
  roots: IXmlElement[],
  errors: IXmlError[],
  addError: (info: IErrorInfo, args: string[], offset: number) => void,
): void {
  const tagStart = tag.nameStart - (tag.closing ? 2 : 1)

  if (tag.closing) {
    const top = stack[stack.length - 1]

    if (top && top.tag === tag.name) {
      stack.pop()
      return
    }

    addError(Errors.xmlMismatchedTag, [top ? top.tag : tag.name, tag.name, String(tagStart)], tagStart)

    // Recover: if the closing tag matches an ancestor, auto-close down to it.
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].tag === tag.name) {
        stack.length = i
        break
      }
    }

    return
  }

  const element: IXmlElement = {
    type: "element",
    tag: tag.name,
    attributes: toAttributes(tag, addError),
    children: [],
    start: tagStart,
  }

  if (stack.length > 0) {
    stack[stack.length - 1].children.push(element)
  } else {
    if (roots.length > 0) {
      addError(Errors.xmlMultipleRoots, [String(tagStart)], tagStart)
    }

    roots.push(element)
  }

  if (!tag.selfClosing) {
    stack.push(element)
  }
}

function toAttributes(
  tag: IXmlTag,
  addError: (info: IErrorInfo, args: string[], offset: number) => void,
): Record<string, string> {
  const attributes: Record<string, string> = {}

  for (const attr of tag.attrs) {
    if (!attr.name) {
      continue
    }

    if (attr.unterminated) {
      addError(Errors.xmlUnexpectedEnd, [String(attr.valueEnd ?? attr.nameEnd)], attr.valueEnd ?? attr.nameEnd)
    } else if (attr.malformed) {
      addError(Errors.xmlInvalidAttribute, [String(attr.nameStart)], attr.nameStart)
    }

    attributes[attr.name] = attr.value === undefined ? "" : decodeEntities(attr.value)
  }

  return attributes
}

function decodeEntities(value: string): string {
  if (value.indexOf("&") === -1) {
    return value
  }

  return value.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (match, entity: string) => {
    if (entity.charCodeAt(0) === CC_HASH) {
      const second = entity.charCodeAt(1)
      const isHex = second === CC_X_LOWER || second === CC_X_UPPER
      const code = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)

      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }

    switch (entity) {
      case "amp":
        return "&"
      case "lt":
        return "<"
      case "gt":
        return ">"
      case "quot":
        return '"'
      case "apos":
        return "'"
      default:
        return match
    }
  })
}
