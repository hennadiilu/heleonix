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
} from "@heleonix/hx-language"
import { IXmlScan } from "@heleonix/hx-compiler-core"
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

/**
 * Produces semantic tokens for a `*.hxm` document, mapping the structural scan
 * (from hx-compiler-core) and binding tokenizer to standard LSP token types.
 */
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

      const isName = attr.name === NAME_ATTRIBUTE
      const isOverride = !isName && getOverrideTarget(attr.name) !== undefined

      if (isName) {
        push(raw, attr.nameStart, attr.name.length, TOKEN_TYPE.keyword)
      } else if (isOverride) {
        pushOverrideName(raw, attr.name, attr.nameStart)
      } else {
        pushAttrName(raw, attr.name, attr.nameStart)
      }

      if (attr.value === undefined || attr.valueStart === undefined) {
        continue
      }

      // Quotes take the value kind's color; `name` reads as a readonly variable
      // and an override value as the component type it names.
      const quoteType = isName ? TOKEN_TYPE.variable : isOverride ? TOKEN_TYPE.class : sourceTokenType(attr.value)
      const quoteModifiers = isName ? TOKEN_MODIFIER.readonly : 0
      push(raw, attr.valueStart - 1, 1, quoteType, quoteModifiers)
      if (!attr.unterminated && attr.valueEnd !== undefined) {
        push(raw, attr.valueEnd, 1, quoteType, quoteModifiers)
      }

      if (isName) {
        pushDeclaredName(raw, attr.value, attr.valueStart)
      } else if (isOverride) {
        pushOverrideValue(raw, attr.value, attr.valueStart)
      } else {
        pushBinding(raw, attr.value, attr.valueStart)
      }
    }
  }

  for (const node of scan.texts) {
    pushBinding(raw, node.value, node.start)
  }

  raw.sort((a, b) => a.offset - b.offset)

  const builder = new SemanticTokensBuilder()

  for (const token of raw) {
    const pos = doc.positionAt(token.offset)
    builder.push(pos.line, pos.character, token.length, token.type, token.modifiers)
  }

  return builder.build()
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

/** `target:Component` override name (attribute or tag): target chain, `:`, then the `Component` keyword. */
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

/** `target:Component` value: a `@Dic`/`#Cfg` reference keeps its color, a bare component name reads as a type. */
function pushOverrideValue(raw: RawToken[], value: string, valueStart: number): void {
  const type = parseBindingExpression(value).type

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

/** `component:property` (component may be dotted) or a plain property path. */
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
