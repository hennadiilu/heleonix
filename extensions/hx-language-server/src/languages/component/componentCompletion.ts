import {
  BUILTIN_TAGS,
  COMPONENT_NAME_SEGMENT_SEPARATOR,
  COMPONENT_PROPERTY_SEPARATOR,
  CONVERTER_PIPE,
  DICTIONARY_REF_PREFIX,
  CONFIG_REF_PREFIX,
  NAME_ATTRIBUTE,
  OVERRIDE_PROPERTY,
  getOverrideTarget,
} from "@heleonix/hx-language"
import { IXmlAttribute } from "@heleonix/hx-compiler-core"
import { IXmlScan } from "@heleonix/hx-compiler-core"
import { CompletionItem, CompletionItemKind, Position, Range } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { DefinitionIndex } from "../../index/DefinitionIndex"
import { completionItem } from "../../lsp/completionItem"
import { replaceRange } from "../../lsp/replaceRange"
import { PLATFORM_DATA } from "../../platform/PLATFORM_DATA"
import { referenceCompletion } from "../../references/referenceCompletion"
import { currentComponents } from "./currentComponents"

// XML tag/attribute names (allow `.`, `:`, `-`) - container syntax, not a bare
// Heleonix identifier; WORD_TAIL is the identifier word under the cursor.
const TAG = /<([A-Za-z_][\w.-]*)?$/
const NAME_CHAR = /[A-Za-z0-9_.:-]/

/**
 * Completion for `*.hxm`: `@`/`#` references (shared), state-binding values
 * inside attribute quotes, `<` component tags, and property names inside an open
 * start tag.
 */
export function completeComponent(
  doc: TextDocument,
  position: Position,
  index: DefinitionIndex,
  scan: IXmlScan,
): CompletionItem[] {
  const offset = doc.offsetAt(position)
  const text = doc.getText()
  const before = text.slice(0, offset)
  const line = before.slice(before.lastIndexOf("\n") + 1)

  const references = referenceCompletion(doc, offset, line, index)

  if (references) {
    return references
  }

  const valueAttr = attrValueAt(scan, offset)

  if (valueAttr !== undefined) {
    const { attr, valueStart } = valueAttr
    const typed = text.slice(valueStart, offset)

    // Inside a `target:Component` value the completions are component names, not
    // dictionary/config references or state - those are handled above / skipped.
    if (attr.name && getOverrideTarget(attr.name) !== undefined) {
      return overrideValueItems(doc, offset, typed, valueStart, index)
    }

    return stateValueItems(doc, offset, typed, valueStart, currentComponents(doc), index)
  }

  const tag = TAG.exec(line)

  if (tag) {
    const range = replaceRange(doc, offset, (tag[1] ?? "").length)
    const items = index
      .componentTags()
      .map((name) => completionItem(name, CompletionItemKind.Class, range, index.componentDocs(name)?.summary))

    for (const name of [...BUILTIN_TAGS].sort()) {
      items.push(completionItem(name, CompletionItemKind.Keyword, range))
    }

    for (const name of PLATFORM_DATA.tags()) {
      items.push(completionItem(name, CompletionItemKind.Property, range, PLATFORM_DATA.tagDocs(name)?.summary))
    }

    return items
  }

  return propertyItems(doc, offset, before, text, index)
}

/** The attribute (and its value start) the cursor sits inside, excluding `name`, or `undefined`. */
function attrValueAt(scan: IXmlScan, offset: number): { attr: IXmlAttribute; valueStart: number } | undefined {
  for (const tag of scan.tags) {
    if (tag.closing) {
      continue
    }

    for (const attr of tag.attrs) {
      if (attr.name === NAME_ATTRIBUTE || attr.valueStart === undefined) {
        continue
      }

      const end = attr.valueEnd ?? Number.MAX_SAFE_INTEGER

      if (offset >= attr.valueStart && offset <= end) {
        return { attr, valueStart: attr.valueStart }
      }
    }
  }

  return undefined
}

/** Component-name completions offered inside a `target:Component` override value. */
function overrideValueItems(
  doc: TextDocument,
  offset: number,
  typed: string,
  valueStart: number,
  index: DefinitionIndex,
): CompletionItem[] {
  const lead = typed.length - typed.trimStart().length
  const range = replaceRange(doc, offset, typed.length - lead)

  return index
    .componentTags()
    .map((name) => completionItem(name, CompletionItemKind.Class, range, index.componentDocs(name)?.summary))
}

/**
 * Properties/controls for a state-binding value being typed in this file. A
 * bare path or control-name prefix offers the current component's incoming
 * property pool plus its control names; after a `ctrl:` qualifier, the resolved
 * control's incoming property pool. References and converters are not state and
 * are handled elsewhere / skipped.
 */
function stateValueItems(
  doc: TextDocument,
  offset: number,
  typed: string,
  valueStart: number,
  components: readonly string[],
  index: DefinitionIndex,
): CompletionItem[] {
  const lead = typed.charAt(typed.length - typed.trimStart().length)

  if (lead === DICTIONARY_REF_PREFIX || lead === CONFIG_REF_PREFIX || typed.includes(CONVERTER_PIPE)) {
    return []
  }

  const colon = typed.indexOf(COMPONENT_PROPERTY_SEPARATOR)

  if (colon >= 0) {
    const targets = resolveTargets(components, typed.slice(0, colon), index)
    const range = replaceRange(doc, offset, offset - (valueStart + colon + 1))
    return propertyItems2(targets, (component) => index.incomingProperties(component), CompletionItemKind.Field, range)
  }

  const skip = typed.length - typed.trimStart().length
  const range = replaceRange(doc, offset, typed.length - skip)
  const items = propertyItems2(
    components,
    (component) => index.incomingProperties(component),
    CompletionItemKind.Field,
    range,
  )

  for (const control of controlsOf(components, index)) {
    items.push(completionItem(control, CompletionItemKind.Variable, range))
  }

  return items
}

function propertyItems(
  doc: TextDocument,
  offset: number,
  before: string,
  text: string,
  index: DefinitionIndex,
): CompletionItem[] {
  const lt = before.lastIndexOf("<")
  const gt = before.lastIndexOf(">")

  // Only inside an open start tag (not after it closed, not a closing/comment tag).
  if (lt < 0 || lt < gt || !/[A-Za-z]/.test(text.charAt(lt + 1))) {
    return []
  }

  let i = lt + 1

  while (i < text.length && NAME_CHAR.test(text.charAt(i))) {
    i++
  }

  const tagName = text.slice(lt + 1, i)

  // The attribute-name token under the cursor (may carry a `ctrl:` qualifier).
  let tokenStart = offset

  while (tokenStart > lt + 1 && NAME_CHAR.test(text.charAt(tokenStart - 1))) {
    tokenStart--
  }

  const token = text.slice(tokenStart, offset)
  const colon = token.indexOf(COMPONENT_PROPERTY_SEPARATOR)

  if (colon >= 0) {
    const targets = resolveTargets([tagName], token.slice(0, colon), index)
    const range = replaceRange(doc, offset, offset - (tokenStart + colon + 1))
    const items = propertyItems2(
      targets,
      (component) => index.consumedProperties(component),
      CompletionItemKind.Property,
      range,
    )

    // A chain target can be a platform control (`<button name="add">`), whose
    // settable pool is the platform's attribute set.
    pushPlatformAttributeItems(targets, range, items)

    // `target:Component` overrides the component at that target.
    items.push(completionItem(OVERRIDE_PROPERTY, CompletionItemKind.Keyword, range))

    return items
  }

  const range = replaceRange(doc, offset, token.length)
  const propertyDocs = index.componentDocs(tagName)?.props
  const items = index
    .componentProperties(tagName)
    .map((name) => completionItem(name, CompletionItemKind.Property, range, propertyDocs?.[name]))

  pushPlatformAttributeItems([tagName], range, items)

  for (const control of index.controlNames(tagName)) {
    items.push(completionItem(control, CompletionItemKind.Variable, range))
  }

  items.push(completionItem(NAME_ATTRIBUTE, CompletionItemKind.Property, range))

  return items
}

/** Adds the platform attributes (with W3C/MDN docs) of every platform tag among `tags`, deduplicated. */
function pushPlatformAttributeItems(tags: Iterable<string>, range: Range, items: CompletionItem[]): void {
  const seen = new Set(items.map((item) => item.label))

  for (const tag of tags) {
    for (const attribute of PLATFORM_DATA.attributes(tag)) {
      if (!seen.has(attribute)) {
        seen.add(attribute)
        items.push(
          completionItem(
            attribute,
            CompletionItemKind.Property,
            range,
            PLATFORM_DATA.attributeDocs(tag, attribute)?.summary,
          ),
        )
      }
    }
  }
}

/** Components a `ctrl.nested` prefix resolves to from `starts` (empty when it names no known control). */
function resolveTargets(starts: readonly string[], prefix: string, index: DefinitionIndex): Set<string> {
  const segments = prefix.split(COMPONENT_NAME_SEGMENT_SEPARATOR).filter(Boolean)
  return index.resolveControlChain(starts, segments)
}

function controlsOf(components: readonly string[], index: DefinitionIndex): string[] {
  const controls = new Set<string>()

  for (const component of components) {
    for (const control of index.controlNames(component)) {
      controls.add(control)
    }
  }

  return [...controls].sort()
}

function propertyItems2(
  components: Iterable<string>,
  propertiesOf: (component: string) => readonly string[],
  itemKind: CompletionItemKind,
  range: Range,
): CompletionItem[] {
  const properties = new Set<string>()

  for (const component of components) {
    for (const property of propertiesOf(component)) {
      properties.add(property)
    }
  }

  return [...properties].sort().map((name) => completionItem(name, itemKind, range))
}
