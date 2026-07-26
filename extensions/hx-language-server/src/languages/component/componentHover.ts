import {
  COMPONENT_NAME_SEGMENT_SEPARATOR,
  NAME_ATTRIBUTE,
  REFERENCE_PREFIXES,
  REFERENCE_SEPARATORS,
  getOverrideTarget,
  isBindingExpression,
  parseBindingExpression,
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

/**
 * Hover for `*.hxm`: component docs on a tag name, `@prop` docs on an
 * attribute name (resolving any `ctrl:` prefix), and dictionary/config entry
 * docs on a `@Name.entry` / `#Name.entry` binding (attribute value or text
 * content). Tags/attributes the index doesn't document fall back to the
 * platform's component data (HTML elements per W3C/MDN, with reference
 * links). Symbols without docs yield no hover.
 */
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

        return isOverride
          ? overrideValueHover(doc, attr.value, attr.valueStart, end, index)
          : referenceHover(doc, attr.value, attr.valueStart, end, index)
      }
    }
  }

  for (const text of scan.texts) {
    if (offset >= text.start && offset <= text.end) {
      return referenceHover(doc, text.value.trim(), text.start, text.end, index)
    }
  }

  return null
}

/** Type + docs of the property the attribute sets, resolved on the `ctrl:` chain target(s). */
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

/** Docs of the component a `target:Component` value names (or the entry, for a `@`/`#` value). */
function overrideValueHover(
  doc: TextDocument,
  raw: string,
  start: number,
  end: number,
  index: DefinitionIndex,
): Hover | null {
  const value = raw.trim()

  if (!value || !isBindingExpression(value)) {
    return null
  }

  const expression = parseBindingExpression(value)

  if (expression.type === "dictionary" || expression.type === "config") {
    return referenceHover(doc, raw, start, end, index)
  }

  const docs = index.componentDocs(expression.value)

  return docs ? markdownHover(doc, start, end, renderDocs(`<${expression.value}>`, docs)) : null
}

/** Entry docs of the `@Name.entry` / `#Name.entry` reference the binding points at. */
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
