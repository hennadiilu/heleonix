import { promises as fsp } from "node:fs"
import path from "node:path"
import { IJsoncComment, IJsoncEntry, IXmlScan, jsoncEntryDocs, xmlRootDocs } from "@heleonix/hx-compiler-core"
import {
  BUILTIN_TAGS,
  COMPONENT_PROPERTY_SEPARATOR,
  CONTENT_TAG,
  EXT_CONFIG,
  EXT_DICTIONARY,
  EXT_TEMPLATE,
  IDENTIFIER_PATTERN,
  NAME_ATTRIBUTE,
  REFERENCE_SEPARATORS,
  REFERENCE_TYPES,
  ROOT_TAG,
  ReferenceType,
  getOverrideTarget,
  isBindingExpression,
  parseBindingExpression,
  soleExpression,
} from "@heleonix/hx-language"
import { inlineOverrideScopes, scopeOwnerAt } from "../references/inlineOverrideScopes"
import { scanInterpolations } from "../references/scanInterpolations"
import { scanParameters } from "../references/scanParameters"
import { collectOccurrences } from "../index/occurrences/collectOccurrences"
import { IIncrementalDefinitionSource } from "./IIncrementalDefinitionSource"
import { IIndexContribution } from "../index/IIndexContribution"
import { compositeKey } from "../index/compositeKey"
import { createEmptyContribution } from "../index/createEmptyContribution"
import { parseFile } from "../index/parseFile"

const HX_EXTS = new Set<string>([EXT_TEMPLATE, EXT_DICTIONARY, EXT_CONFIG])

// Inline component name declared by a leading comment, e.g. `<!--CustomAddButton-->`.
const COMPONENT_COMMENT = new RegExp(`<!--\\s*(${IDENTIFIER_PATTERN}(?:\\.${IDENTIFIER_PATTERN})*)`, "g")

export class WorkspaceDefinitionSource implements IIncrementalDefinitionSource {
  public readonly id = "workspace"

  public constructor(
    private readonly roots: readonly string[],
    private readonly exclude: ReadonlySet<string>,
  ) {}

  public async load(): Promise<IIndexContribution> {
    const merged = createEmptyContribution()

    for (const contribution of (await this.scanFiles()).values()) {
      mergeInto(merged, contribution)
    }

    return merged
  }

  public async scanFiles(): Promise<Map<string, IIndexContribution>> {
    const result = new Map<string, IIndexContribution>()

    for (const root of this.roots) {
      for await (const file of this.walk(root)) {
        result.set(file, await this.indexFile(file))
      }
    }

    return result
  }

  public handles(filePath: string): boolean {
    if (!HX_EXTS.has(path.extname(filePath))) {
      return false
    }

    return !filePath.split(/[\\/]/).some((segment) => segment.startsWith(".") || this.exclude.has(segment))
  }

  public async indexFile(filePath: string, text?: string): Promise<IIndexContribution> {
    const result = createEmptyContribution()

    let source = text

    if (source === undefined) {
      try {
        source = await fsp.readFile(filePath, "utf8")
      } catch {
        return result
      }
    }

    const name = baseName(filePath)
    // Parse the file once; both the flat contribution below and the located
    // occurrences share this single scan rather than re-parsing the source.
    const parsed = parseFile(filePath, source)

    if (parsed.kind === "dictionary") {
      addEntries(result.references.dictionary, name, parsed.entries)
      indexDictionaryReferences(name, parsed.body, result)
      indexDictionaryParameters(name, parsed.body, parsed.entries, result)
      indexEntryDocs("dictionary", name, parsed, result)
    } else if (parsed.kind === "config") {
      addEntries(result.references.config, name, parsed.entries)
      indexEntryDocs("config", name, parsed, result)
    } else if (parsed.kind === "component") {
      indexComponent(name, source, parsed.scan, result)

      const docs = xmlRootDocs(parsed.scan, source, ROOT_TAG)

      if (docs) {
        result.componentDocs[name] = docs
      }
    }

    result.occurrences = collectOccurrences(filePath, source, parsed)

    return result
  }

  private async *walk(dir: string): AsyncGenerator<string> {
    let entries

    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue
      }

      const full = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (!this.exclude.has(entry.name)) {
          yield* this.walk(full)
        }
      } else if (HX_EXTS.has(path.extname(entry.name))) {
        yield full
      }
    }
  }
}

function indexComponent(fileName: string, source: string, scan: IXmlScan, result: IIndexContribution): void {
  // References and internal state are attributed to every component declared in
  // the file (its base name plus each `<!--Name-->`), rather than to a single
  // `<Component>` block - an over-approximation that only widens property pools,
  // which is the safe direction (fewer false "unknown" warnings).
  const componentNames = [fileName]

  result.components.push(fileName)

  COMPONENT_COMMENT.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = COMPONENT_COMMENT.exec(source)) !== null) {
    result.components.push(match[1])
    componentNames.push(match[1])
  }

  // An inline `<target:Component>` override is its own anonymous scope, so its
  // contents attribute to a synthetic owner rather than the enclosing component.
  const scopes = inlineOverrideScopes(scan, fileName)
  const ownersAt = (offset: number): readonly string[] => {
    const owner = scopeOwnerAt(offset, scopes)

    return owner ? [owner] : componentNames
  }

  for (const tag of scan.tags) {
    if (tag.closing) {
      continue
    }

    // An inline `<target:Component>` override is not a tag usage of its own.
    if (getOverrideTarget(tag.name) !== undefined) {
      continue
    }

    const owners = ownersAt(tag.nameStart)

    if (isUsedTag(tag.name)) {
      for (const comp of owners) {
        pushUnique((result.usedTags[comp] ??= []), tag.name)
      }
    }

    const props = (result.tagProperties[tag.name] ??= [])

    for (const attr of tag.attrs) {
      if (!attr.name) {
        continue
      }

      if (attr.name === NAME_ATTRIBUTE) {
        if (attr.kind === "literal" && attr.value) {
          for (const comp of owners) {
            pushUnique((result.namedControls[compositeKey(comp, attr.value)] ??= []), tag.name)
          }
        }

        continue
      }

      // A `target:Component` override is neither a settable property nor a state
      // read; only its dictionary/config value participates as an entry usage.
      if (getOverrideTarget(attr.name) !== undefined) {
        // Only a braced reference contributes an entry usage; quoted text names
        // the replacement component, which is resolved elsewhere.
        if (attr.kind === "expression" && attr.value) {
          indexOverrideValue(attr.value, owners, result)
        }

        continue
      }

      // The short form's name is the expression itself, so it is not a
      // separately-written property name on the tag.
      if (!attr.shorthand && !props.includes(attr.name)) {
        props.push(attr.name)
      }

      if (attr.kind === "expression" && attr.value) {
        indexBinding(attr.value, owners, result)
      }
    }
  }

  // Static text references nothing; only a run that is one `{...}` expression does.
  for (const text of scan.texts) {
    const expression = soleExpression(text.value)

    if (expression) {
      indexBinding(expression.text.trim(), ownersAt(text.start + expression.start), result)
    }
  }
}

function isUsedTag(name: string): boolean {
  return Boolean(name) && name !== ROOT_TAG && name !== CONTENT_TAG && !BUILTIN_TAGS.has(name)
}

function indexOverrideValue(raw: string, componentNames: readonly string[], result: IIndexContribution): void {
  const value = raw.trim()

  if (!value || !isBindingExpression(value)) {
    return
  }

  const expression = parseBindingExpression(value)

  if (expression.type !== "dictionary" && expression.type !== "config") {
    return
  }

  const separator = REFERENCE_SEPARATORS[expression.type]
  const split = expression.value.lastIndexOf(separator)

  if (split <= 0) {
    return
  }

  const key = compositeKey(expression.value.slice(0, split), expression.value.slice(split + 1))
  const target = result.entryReferrers[expression.type]

  for (const comp of componentNames) {
    pushUnique((target[key] ??= []), comp)
  }
}

function indexBinding(raw: string, componentNames: readonly string[], result: IIndexContribution): void {
  if (!raw || !isBindingExpression(raw)) {
    return
  }

  const expression = parseBindingExpression(raw)

  if (expression.type === "dictionary" || expression.type === "config") {
    const separator = REFERENCE_SEPARATORS[expression.type]
    const split = expression.value.lastIndexOf(separator)

    if (split <= 0) {
      return
    }

    const key = compositeKey(expression.value.slice(0, split), expression.value.slice(split + 1))
    const target = result.entryReferrers[expression.type]

    for (const comp of componentNames) {
      pushUnique((target[key] ??= []), comp)
    }

    return
  }

  // A bare state path (no `ctrl:` qualifier) reads one of the component's own
  // properties, so record the full path. A qualified `ctrl:prop` reads from a
  // named control instead and is not the component's own property.
  if (!expression.value.includes(COMPONENT_PROPERTY_SEPARATOR)) {
    const path = expression.value.trim()

    if (path) {
      for (const comp of componentNames) {
        pushUnique((result.componentState[comp] ??= []), path)
      }
    }
  }
}

function indexDictionaryReferences(dictName: string, body: string, result: IIndexContribution): void {
  for (const ref of scanInterpolations(body)) {
    if (ref.kind === "dictionary" && ref.name && ref.entry) {
      pushUnique((result.entryReferrers.dictionary[compositeKey(ref.name, ref.entry)] ??= []), dictName)
    }
  }
}

function indexDictionaryParameters(
  dictName: string,
  body: string,
  entries: readonly IJsoncEntry[],
  result: IIndexContribution,
): void {
  for (const entry of entries) {
    for (const param of scanParameters(body.slice(entry.valueStart, entry.valueEnd))) {
      pushUnique((result.entryParameters[compositeKey(dictName, entry.key)] ??= []), param.name)
    }
  }
}

function indexEntryDocs(
  kind: ReferenceType,
  name: string,
  parsed: { body: string; entries: readonly IJsoncEntry[]; comments: readonly IJsoncComment[] },
  result: IIndexContribution,
): void {
  const docs = jsoncEntryDocs(parsed.entries, parsed.comments, parsed.body)

  for (const key in docs) {
    result.entryDocs[kind][compositeKey(name, key)] = docs[key]
  }
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value)
  }
}

function baseName(file: string): string {
  const stem = path.basename(file, path.extname(file))
  // Strip dimension suffixes (e.g. "Greeting.fr-FR" -> "Greeting").
  return stem.split(".")[0]
}

function addEntries(target: Record<string, string[]>, name: string, entries: readonly IJsoncEntry[]): void {
  if (entries.length > 0) {
    target[name] = (target[name] ?? []).concat(entries.map((entry) => entry.key))
  }
}

function mergeInto(target: IIndexContribution, source: IIndexContribution): void {
  target.components.push(...source.components)
  mergeRecords(target.tagProperties, source.tagProperties)
  mergeRecords(target.usedTags, source.usedTags)
  mergeRecords(target.componentState, source.componentState)
  mergeRecords(target.entryParameters, source.entryParameters)
  mergeRecords(target.namedControls, source.namedControls)
  Object.assign(target.componentDocs, source.componentDocs)

  for (const kind of REFERENCE_TYPES) {
    mergeRecords(target.references[kind], source.references[kind])
    mergeRecords(target.entryReferrers[kind], source.entryReferrers[kind])
    Object.assign(target.entryDocs[kind], source.entryDocs[kind])
  }
}

function mergeRecords(target: Record<string, string[]>, source: Record<string, string[]>): void {
  for (const key in source) {
    target[key] = (target[key] ?? []).concat(source[key])
  }
}
