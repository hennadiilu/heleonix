import { BindingTokenKind } from "../../references/BindingTokenKind"
import { tokenizeBinding } from "../../references/tokenizeBinding"
import {
  BUILTIN_TAGS,
  COMPONENT_PROPERTY_SEPARATOR,
  NAME_ATTRIBUTE,
  PROPERTY_NAME_SEGMENT_SEPARATOR,
  ROOT_TAG,
  getOverrideTarget,
  parseBindingExpression,
  soleExpression,
} from "@heleonix/hx-language"
import { IXmlAttribute, IXmlScan } from "@heleonix/hx-compiler-core"
import { SemanticTokens, SemanticTokensBuilder } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { TOKEN_MODIFIER, TOKEN_TYPE } from "./tokenLegend"

interface RawToken {
  offset: number
  length: number
  type: number
  modifiers: number
}

// Binding token kinds (from hx-compiler-core) -> this editor's legend.
const BINDING_TYPE: Readonly<Record<BindingTokenKind, number>> = {
  dictionaryPrefix: TOKEN_TYPE.string,
  dictionaryName: TOKEN_TYPE.string,
  configPrefix: TOKEN_TYPE.number,
  configName: TOKEN_TYPE.number,
  stateName: TOKEN_TYPE.variable,
  componentName: TOKEN_TYPE.variable,
  converter: TOKEN_TYPE.function,
  separator: TOKEN_TYPE.operator,
  pipe: TOKEN_TYPE.operator,
}

const BINDING_MODIFIER: Partial<Record<BindingTokenKind, number>> = {
  configPrefix: TOKEN_MODIFIER.readonly,
  configName: TOKEN_MODIFIER.readonly,
  componentName: TOKEN_MODIFIER.readonly,
}

export function buildComponentSemanticTokens(doc: TextDocument, scan: IXmlScan): SemanticTokens {
  const raw: RawToken[] = []

  for (const tag of scan.tags) {
    if (getOverrideTarget(tag.name) !== undefined) {
      pushOverrideName(raw, tag.name, tag.nameStart)
    } else {
      pushTag(raw, tag.name, tag.nameStart)
    }

    for (const attr of tag.attrs) {
      if (!attr.name) {
        continue
      }

      pushAttribute(raw, attr)
    }
  }

  // Static text is a string literal; a run that is one `{...}` expression is
  // tokenized as the binding it holds.
  for (const node of scan.texts) {
    const expression = soleExpression(node.value)

    if (!expression) {
      pushText(raw, node.value, node.start)

      continue
    }

    const start = node.start + expression.start
    const type = sourceTokenType(expression.text)
    push(raw, start - 1, 1, type)
    pushBinding(raw, expression.text, start)
    push(raw, node.start + expression.end, 1, type)
  }

  raw.sort((a, b) => a.offset - b.offset)

  const builder = new SemanticTokensBuilder()

  for (const token of raw) {
    const pos = doc.positionAt(token.offset)
    builder.push(pos.line, pos.character, token.length, token.type, token.modifiers)
  }

  return builder.build()
}

function pushAttribute(raw: RawToken[], attr: IXmlAttribute): void {
  const isName = attr.name === NAME_ATTRIBUTE
  const isOverride = !isName && getOverrideTarget(attr.name) !== undefined

  if (!attr.shorthand) {
    if (isName) {
      push(raw, attr.nameStart, attr.name.length, TOKEN_TYPE.keyword)
    } else if (isOverride) {
      pushOverrideName(raw, attr.name, attr.nameStart)
    } else {
      pushAttrName(raw, attr.name, attr.nameStart)
    }
  }

  if (attr.kind === "flag" || attr.value === undefined || attr.valueStart === undefined) {
    return
  }

  const isExpression = attr.kind === "expression"
  const delimiterType = isName
    ? TOKEN_TYPE.variable
    : isOverride
      ? TOKEN_TYPE.class
      : isExpression
        ? sourceTokenType(attr.value)
        : TOKEN_TYPE.string
  const delimiterModifiers = isName ? TOKEN_MODIFIER.readonly : 0

  push(raw, attr.valueStart - 1, 1, delimiterType, delimiterModifiers)

  if (!attr.unterminated && attr.valueEnd !== undefined) {
    push(raw, attr.valueEnd, 1, delimiterType, delimiterModifiers)
  }

  if (isName) {
    pushDeclaredName(raw, attr.value, attr.valueStart)
  } else if (isOverride) {
    pushOverrideValue(raw, isExpression, attr.value, attr.valueStart)
  } else if (isExpression) {
    pushBinding(raw, attr.value, attr.valueStart)
  } else {
    pushText(raw, attr.value, attr.valueStart)
  }
}

function pushText(raw: RawToken[], value: string, start: number): void {
  const lead = value.length - value.trimStart().length
  const text = value.trim()

  if (text) {
    push(raw, start + lead, text.length, TOKEN_TYPE.string)
  }
}

function pushTag(raw: RawToken[], name: string, start: number): void {
  if (!name) {
    return
  }

  if (name === ROOT_TAG) {
    push(raw, start, name.length, TOKEN_TYPE.namespace)
  } else if (BUILTIN_TAGS.has(name)) {
    push(raw, start, name.length, TOKEN_TYPE.keyword)
  } else {
    push(raw, start, name.length, TOKEN_TYPE.class)
  }
}

function pushDeclaredName(raw: RawToken[], value: string, valueStart: number): void {
  const lead = value.length - value.trimStart().length
  const name = value.trim()

  if (name) {
    push(raw, valueStart + lead, name.length, TOKEN_TYPE.variable, TOKEN_MODIFIER.readonly)
  }
}

function pushOverrideName(raw: RawToken[], name: string, start: number): void {
  const colon = name.indexOf(COMPONENT_PROPERTY_SEPARATOR)

  if (colon <= 0) {
    push(raw, start, name.length, TOKEN_TYPE.keyword)
    return
  }

  pushSegmented(raw, name.slice(0, colon), start, TOKEN_TYPE.property, TOKEN_MODIFIER.readonly)
  push(raw, start + colon, 1, TOKEN_TYPE.operator)
  push(raw, start + colon + 1, name.length - colon - 1, TOKEN_TYPE.keyword)
}

function pushOverrideValue(raw: RawToken[], isExpression: boolean, value: string, valueStart: number): void {
  const type = isExpression ? parseBindingExpression(value).type : "literal"

  if (type === "dictionary" || type === "config") {
    pushBinding(raw, value, valueStart)
    return
  }

  const lead = value.length - value.trimStart().length
  const name = value.trim()

  if (name) {
    push(raw, valueStart + lead, name.length, TOKEN_TYPE.class)
  }
}

function pushAttrName(raw: RawToken[], name: string, start: number): void {
  const colon = name.indexOf(COMPONENT_PROPERTY_SEPARATOR)

  if (colon > 0) {
    pushSegmented(raw, name.slice(0, colon), start, TOKEN_TYPE.property, TOKEN_MODIFIER.readonly)
    push(raw, start + colon, 1, TOKEN_TYPE.operator)
    pushSegmented(raw, name.slice(colon + 1), start + colon + 1, TOKEN_TYPE.property)
    return
  }

  pushSegmented(raw, name, start, TOKEN_TYPE.property)
}

function pushSegmented(raw: RawToken[], text: string, base: number, type: number, modifiers = 0): void {
  let i = 0

  while (i < text.length) {
    if (text.charAt(i) === PROPERTY_NAME_SEGMENT_SEPARATOR) {
      push(raw, base + i, 1, TOKEN_TYPE.operator)
      i++
      continue
    }

    let j = i

    while (j < text.length && text.charAt(j) !== PROPERTY_NAME_SEGMENT_SEPARATOR) {
      j++
    }

    push(raw, base + i, j - i, type, modifiers)
    i = j
  }
}

function pushBinding(raw: RawToken[], value: string, base: number): void {
  for (const token of tokenizeBinding(value)) {
    push(raw, base + token.start, token.length, BINDING_TYPE[token.kind], BINDING_MODIFIER[token.kind] ?? 0)
  }
}

function sourceTokenType(value: string): number {
  const type = parseBindingExpression(value).type

  if (type === "dictionary") {
    return TOKEN_TYPE.string
  }

  if (type === "config") {
    return TOKEN_TYPE.number
  }

  return TOKEN_TYPE.variable
}

function push(raw: RawToken[], offset: number, length: number, type: number, modifiers = 0): void {
  if (length > 0) {
    raw.push({ offset, length, type, modifiers })
  }
}
