import {
  COMPONENT_NAME_SEGMENT_SEPARATOR,
  NAME_ATTRIBUTE,
  REFERENCE_PREFIXES,
  REFERENCE_SEPARATORS,
  getOverrideTarget,
  isBindingExpression,
  parseBindingExpression,
  soleExpression,
} from "@heleonix/hx-language"
import { IXmlAttribute, IXmlScan } from "@heleonix/hx-compiler-core"
import type { IComponentInfo } from "@heleonix/hx-analyzer"
import { Hover, Position } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { DefinitionIndex } from "../../index/DefinitionIndex"
import { markdownHover } from "../../lsp/markdownHover"
import { renderDocs } from "../../lsp/renderDocs"
import { byName, componentDocs, memberOf, memberSummary, memberType } from "./componentInfoLookup"
import { headSegment } from "../../references/headSegment"
import { splitComponentPrefix } from "../../references/splitComponentPrefix"

export function hoverComponent(
  doc: TextDocument,
  position: Position,
  index: DefinitionIndex,
  scan: IXmlScan,
  components: readonly IComponentInfo[],
): Hover | null {
  const offset = doc.offsetAt(position)
  const registry = byName(components)

  for (const tag of scan.tags) {
    if (offset >= tag.nameStart && offset <= tag.nameEnd) {
      const docs = componentDocs(registry.get(tag.name))
      return docs ? markdownHover(doc, tag.nameStart, tag.nameEnd, renderDocs(`<${tag.name}>`, docs)) : null
    }

    if (tag.closing) {
      continue
    }

    for (const attr of tag.attrs) {
      const isOverride =
        Boolean(attr.name) && attr.name !== NAME_ATTRIBUTE && getOverrideTarget(attr.name) !== undefined

      if (attr.name && attr.name !== NAME_ATTRIBUTE && offset >= attr.nameStart && offset <= attr.nameEnd) {
        // The `Component` keyword itself carries no docs; only its value does.
        return isOverride ? null : attributeHover(doc, tag.name, attr, index, registry)
      }

      if (
        attr.name !== NAME_ATTRIBUTE &&
        attr.value !== undefined &&
        attr.valueStart !== undefined &&
        offset >= attr.valueStart &&
        offset <= (attr.valueEnd ?? attr.valueStart)
      ) {
        const end = attr.valueEnd ?? attr.valueStart

        if (isOverride) {
          return overrideValueHover(doc, attr.kind === "expression", attr.value, attr.valueStart, end, index)
        }

        // Quoted text is a static string - it points at nothing to describe.
        return attr.kind === "expression" ? referenceHover(doc, attr.value, attr.valueStart, end, index) : null
      }
    }
  }

  for (const text of scan.texts) {
    if (offset >= text.start && offset <= text.end) {
      const expression = soleExpression(text.value)

      return expression
        ? referenceHover(doc, expression.text.trim(), text.start + expression.start, text.start + expression.end, index)
        : null
    }
  }

  return null
}

function attributeHover(
  doc: TextDocument,
  tagName: string,
  attr: IXmlAttribute,
  index: DefinitionIndex,
  registry: Map<string, IComponentInfo>,
): Hover | null {
  const { prefix, path } = splitComponentPrefix(attr.name)
  const head = headSegment(path)

  if (!head) {
    return null
  }

  const segments = prefix ? prefix.split(COMPONENT_NAME_SEGMENT_SEPARATOR).filter(Boolean) : []

  for (const target of index.resolveControlChain([tagName], segments)) {
    const member = memberOf(registry, target, path) ?? memberOf(registry, target, head)

    if (member) {
      const summary = memberSummary(member)
      const signature = `**\`${member.name}${member.optional ? "?" : ""}: ${memberType(member)}\`**`

      return markdownHover(doc, attr.nameStart, attr.nameEnd, summary ? `${signature}\n\n${summary}` : signature)
    }
  }

  return null
}

function overrideValueHover(
  doc: TextDocument,
  isExpression: boolean,
  raw: string,
  start: number,
  end: number,
  index: DefinitionIndex,
): Hover | null {
  const value = raw.trim()

  if (!value) {
    return null
  }

  // Quoted text names the replacement component directly.
  if (!isExpression) {
    return componentHover(doc, value, start, end, index)
  }

  if (!isBindingExpression(value)) {
    return null
  }

  const expression = parseBindingExpression(value)

  if (expression.type === "dictionary" || expression.type === "config") {
    return referenceHover(doc, raw, start, end, index)
  }

  return componentHover(doc, expression.value, start, end, index)
}

function componentHover(
  doc: TextDocument,
  name: string,
  start: number,
  end: number,
  index: DefinitionIndex,
): Hover | null {
  const docs = index.componentDocs(name)

  return docs ? markdownHover(doc, start, end, renderDocs(`<${name}>`, docs)) : null
}

function referenceHover(
  doc: TextDocument,
  raw: string,
  start: number,
  end: number,
  index: DefinitionIndex,
): Hover | null {
  if (!raw || !isBindingExpression(raw)) {
    return null
  }

  const expression = parseBindingExpression(raw)

  if (expression.type !== "dictionary" && expression.type !== "config") {
    return null
  }

  const split = expression.value.lastIndexOf(REFERENCE_SEPARATORS[expression.type])

  if (split <= 0) {
    return null
  }

  const name = expression.value.slice(0, split)
  const entry = expression.value.slice(split + 1)
  const docs = index.entryDocs(expression.type, name, entry)

  if (!docs) {
    return null
  }

  const title = `${REFERENCE_PREFIXES[expression.type]}${expression.value}`

  return markdownHover(doc, start, end, renderDocs(title, docs))
}
