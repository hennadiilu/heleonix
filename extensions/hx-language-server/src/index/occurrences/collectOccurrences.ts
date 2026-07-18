import { IJsoncEntry, IXmlScan } from "@heleonix/hx-compiler-core"
import {
  BUILTIN_TAGS,
  CONFIG_REF_PREFIX,
  CONTENT_TAG,
  CONVERTER_PIPE,
  DICTIONARY_ENTRY_SEPARATOR,
  DICTIONARY_REF_PREFIX,
  EXPRESSION_PATTERN,
  IDENTIFIER_PATTERN,
  NAME_ATTRIBUTE,
  REFERENCE_SEPARATORS,
  ROOT_TAG,
  getOverrideTarget,
  isBindingExpression,
  parseBindingExpression,
} from "@heleonix/hx-language"
import { definitionName } from "../../languages/jsonc/definitionName"
import { headSegment } from "../../references/headSegment"
import { inlineOverrideScopes, scopeOwnerAt } from "../../references/inlineOverrideScopes"
import { splitComponentPrefix } from "../../references/splitComponentPrefix"
import { IParsedFile } from "../parseFile"
import { IFileOccurrences } from "./IFileOccurrences"
import { IPropertyBase } from "./IPropertyBase"
import { IRawOccurrence } from "./IRawOccurrence"
import { OccurrenceRole } from "./OccurrenceRole"
import { lineStartsOf } from "./lineStartsOf"

// Inline component name declared by a leading comment, e.g. `<!--CustomAddButton-->`.
// Mirrors the pattern used while indexing in WorkspaceDefinitionSource.
const COMPONENT_COMMENT = new RegExp(`<!--\\s*(${IDENTIFIER_PATTERN}(?:\\.${IDENTIFIER_PATTERN})*)`, "g")

/**
 * Turns one file's already-parsed artifacts ({@link parseFile}) into located,
 * not-yet-resolved symbol {@link IRawOccurrence}s, plus the line-start table for
 * offset->position mapping. It shares the single parse with the flat index
 * builder rather than re-scanning, so the ranges it produces line up with what
 * the editor highlights. Symbol identity is finalized later by
 * {@link OccurrenceIndex}.
 */
export function collectOccurrences(filePath: string, source: string, parsed: IParsedFile): IFileOccurrences {
  const raw: IRawOccurrence[] = []
  const name = definitionName(filePath)

  if (parsed.kind === "component") {
    collectComponent(name, source, parsed.scan, raw)
  } else if (parsed.kind === "dictionary") {
    collectDictionary(name, parsed.body, parsed.bodyStart, parsed.entries, raw)
  } else if (parsed.kind === "config") {
    collectConfig(name, parsed.bodyStart, parsed.entries, raw)
  }

  return { filePath, lineStarts: lineStartsOf(source), raw }
}

// --- Components (*.hxm) -------------------------------------------------------

function collectComponent(fileName: string, source: string, scan: IXmlScan, raw: IRawOccurrence[]): void {
  // References and internal state attribute to every component the file declares
  // (its base name plus each `<!--Name-->`), matching WorkspaceDefinitionSource.
  const componentNames = [fileName]

  // Bindings inside an inline `<target:Component>` override belong to that
  // override's own anonymous scope, not the enclosing file component.
  const scopes = inlineOverrideScopes(scan, fileName)
  const ownersAt = (offset: number): readonly string[] => {
    const owner = scopeOwnerAt(offset, scopes)

    return owner ? [owner] : componentNames
  }

  COMPONENT_COMMENT.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = COMPONENT_COMMENT.exec(source)) !== null) {
    const nameStart = match.index + match[0].indexOf(match[1])
    raw.push({
      kind: "component",
      role: "definition",
      name: match[1],
      start: nameStart,
      end: nameStart + match[1].length,
    })
    componentNames.push(match[1])
  }

  // The file's default component has no explicit declaration; anchor it at the
  // first `<Component>` root tag so Go To Definition lands on the component body.
  const root = scan.tags.find((tag) => !tag.closing && tag.name === ROOT_TAG)

  if (root) {
    raw.push({ kind: "component", role: "definition", name: fileName, start: root.nameStart, end: root.nameEnd })
  }

  for (const tag of scan.tags) {
    if (isComponentTag(tag.name)) {
      raw.push({ kind: "component", role: "reference", name: tag.name, start: tag.nameStart, end: tag.nameEnd })
    }

    if (tag.closing) {
      continue
    }

    for (const attr of tag.attrs) {
      // A `target:Component` override value names a replacement component or a
      // dictionary/config entry - not a property of, or state read by, the tag.
      if (attr.name && getOverrideTarget(attr.name) !== undefined) {
        if (attr.value && attr.valueStart !== undefined && !attr.unterminated) {
          collectOverrideValue(attr.value, attr.valueStart, raw)
        }

        continue
      }

      // An attribute name sets a property on the component being used. Only real
      // component tags carry framework properties (HTML tags carry their own).
      if (attr.name && attr.name !== NAME_ATTRIBUTE && isComponentTag(tag.name)) {
        pushProperty(
          raw,
          "reference",
          { source: "components", components: [tag.name] },
          attr.name,
          attr.nameStart,
          attr.nameEnd,
        )
      }

      if (
        attr.name === NAME_ATTRIBUTE ||
        attr.value === undefined ||
        attr.valueStart === undefined ||
        attr.unterminated
      ) {
        continue
      }

      if (attr.value !== "") {
        collectBinding(attr.value, attr.valueStart, ownersAt(attr.valueStart), raw)
      }
    }
  }

  for (const node of scan.texts) {
    if (!node.cdata) {
      collectBinding(node.value, node.start, ownersAt(node.start), raw)
    }
  }
}

/** A tag that references a component: not the root/content/override tag and not an HTML/builtin tag. */
function isComponentTag(name: string): boolean {
  return (
    Boolean(name) &&
    name !== ROOT_TAG &&
    name !== CONTENT_TAG &&
    !BUILTIN_TAGS.has(name) &&
    getOverrideTarget(name) === undefined
  )
}

/**
 * An override value (`target:Component="..."`): a `@Dic.entry` / `#Cfg.entry`
 * reference is an entry occurrence; a bare component name is a component
 * reference (so Go To Definition / rename reach the providing `.hxm`).
 */
function collectOverrideValue(rawValue: string, base: number, raw: IRawOccurrence[]): void {
  const span = sourceSpan(rawValue, base)

  if (!span.text || !isBindingExpression(rawValue)) {
    return
  }

  const expression = parseBindingExpression(rawValue)

  if (expression.type === "dictionary" || expression.type === "config") {
    const separator = REFERENCE_SEPARATORS[expression.type]
    const split = expression.value.lastIndexOf(separator)

    if (split <= 0) {
      return
    }

    raw.push({
      kind: expression.type === "dictionary" ? "dictionaryEntry" : "configEntry",
      role: "reference",
      name: expression.value.slice(0, split),
      entry: expression.value.slice(split + 1),
      start: span.start,
      end: span.end,
    })

    return
  }

  raw.push({ kind: "component", role: "reference", name: expression.value, start: span.start, end: span.end })
}

/**
 * Classifies one binding occurrence (attribute value or text run): `@Dic.entry`
 * / `#Cfg.entry` is a dictionary/config entry reference; a bare state path is a
 * property of the file's component(s) - its own property when unqualified (the
 * declaration site), or a read through a named control when `ctrl:`-qualified.
 */
function collectBinding(
  rawValue: string,
  base: number,
  componentNames: readonly string[],
  raw: IRawOccurrence[],
): void {
  const span = sourceSpan(rawValue, base)

  if (!span.text || !isBindingExpression(rawValue)) {
    return
  }

  const expression = parseBindingExpression(rawValue)

  if (expression.type === "dictionary" || expression.type === "config") {
    const separator = REFERENCE_SEPARATORS[expression.type]
    const split = expression.value.lastIndexOf(separator)

    if (split <= 0) {
      return
    }

    raw.push({
      kind: expression.type === "dictionary" ? "dictionaryEntry" : "configEntry",
      role: "reference",
      name: expression.value.slice(0, split),
      entry: expression.value.slice(split + 1),
      start: span.start,
      end: span.end,
    })

    return
  }

  const { prefix } = splitComponentPrefix(expression.value)
  pushProperty(
    raw,
    prefix ? "reference" : "definition",
    { source: "components", components: [...componentNames] },
    expression.value,
    span.start,
    span.end,
  )
}

// --- Dictionaries (*.hxd) ----------------------------------------------------

function collectDictionary(
  dictName: string,
  body: string,
  bodyStart: number,
  entries: readonly IJsoncEntry[],
  raw: IRawOccurrence[],
): void {
  for (const entry of entries) {
    raw.push({
      kind: "dictionaryEntry",
      role: "definition",
      name: dictName,
      entry: entry.key,
      start: bodyStart + entry.keyStart,
      end: bodyStart + entry.keyEnd,
    })

    collectInterpolations(
      dictName,
      entry.key,
      body.slice(entry.valueStart, entry.valueEnd),
      bodyStart + entry.valueStart,
      raw,
    )
  }
}

/**
 * Records the references inside one dictionary value's `{...}` interpolations:
 * `{@Name.entry}` / `{@entry}` are dictionary entry references (the latter to
 * this dictionary's own key); a bare `{param}` is a state property of whichever
 * components reference the enclosing entry. `{#..}` is ignored - dictionaries
 * reference other dictionaries, never configs.
 */
function collectInterpolations(
  dictName: string,
  entryKey: string,
  value: string,
  base: number,
  raw: IRawOccurrence[],
): void {
  const pattern = new RegExp(EXPRESSION_PATTERN, "g")
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value)) !== null) {
    const innerRaw = match[1]
    const inner = innerRaw.trim()

    if (!inner) {
      continue
    }

    const start = base + match.index + 1 + (innerRaw.length - innerRaw.trimStart().length)
    const end = start + inner.length
    const lead = inner.charAt(0)

    if (lead === DICTIONARY_REF_PREFIX) {
      const rest = inner.slice(1).trim()

      if (!rest) {
        continue
      }

      const split = rest.lastIndexOf(DICTIONARY_ENTRY_SEPARATOR)

      if (split > 0) {
        raw.push({
          kind: "dictionaryEntry",
          role: "reference",
          name: rest.slice(0, split),
          entry: rest.slice(split + 1),
          start,
          end,
        })
      } else {
        raw.push({ kind: "dictionaryEntry", role: "reference", name: dictName, entry: rest, start, end })
      }
    } else if (lead !== CONFIG_REF_PREFIX) {
      pushProperty(
        raw,
        "reference",
        { source: "dictionaryReferrers", name: dictName, entry: entryKey },
        inner,
        start,
        end,
      )
    }
  }
}

// --- Configs (*.hxc) ---------------------------------------------------------

function collectConfig(
  configName: string,
  bodyStart: number,
  entries: readonly IJsoncEntry[],
  raw: IRawOccurrence[],
): void {
  for (const entry of entries) {
    raw.push({
      kind: "configEntry",
      role: "definition",
      name: configName,
      entry: entry.key,
      start: bodyStart + entry.keyStart,
      end: bodyStart + entry.keyEnd,
    })
  }
}

// --- Shared helpers ----------------------------------------------------------

/** Appends a property occurrence, splitting `name` into its named-control prefix and property head. */
function pushProperty(
  raw: IRawOccurrence[],
  role: OccurrenceRole,
  base: IPropertyBase,
  name: string,
  start: number,
  end: number,
): void {
  const { prefix, path: propertyPath } = splitComponentPrefix(name)
  const head = headSegment(propertyPath)

  if (head) {
    raw.push({ kind: "property", role, base, prefix, head, start, end })
  }
}

/** The trimmed source span of a binding (before any `| converter`), as absolute offsets. */
function sourceSpan(rawValue: string, base: number): { text: string; start: number; end: number } {
  const pipe = rawValue.indexOf(CONVERTER_PIPE)
  const src = pipe >= 0 ? rawValue.slice(0, pipe) : rawValue
  const lead = src.length - src.trimStart().length
  const text = src.trim()

  return { text, start: base + lead, end: base + lead + text.length }
}
