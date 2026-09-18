import { COMPONENT_NAME_SEGMENT_SEPARATOR, IDocs, REFERENCE_TYPES, ReferenceType } from "@heleonix/hx-language"
import { splitComponentPrefix } from "../references/splitComponentPrefix"
import { compositeKey, splitCompositeKey } from "./compositeKey"
import { IIndexContribution } from "./IIndexContribution"
import { mergeDocs } from "./mergeDocs"

interface ReferenceTable {
  readonly byName: Map<string, Set<string>>

  readonly namesSorted: string[]

  readonly entriesSorted: Map<string, string[]>
}

export type OverrideChainResult =
  | { status: "resolved" }
  | { status: "ambiguous"; segment: string }
  | { status: "unknown"; segment: string }

export class DefinitionIndex {
  private readonly componentsSorted: string[]

  private readonly componentSet: ReadonlySet<string>

  private readonly tagPropsSorted: Map<string, string[]>

  private readonly usedTagsByComponent: Map<string, string[]>

  private readonly tables: ReadonlyMap<ReferenceType, ReferenceTable>

  private readonly referrersByKind: ReadonlyMap<ReferenceType, Map<string, string[]>>

  private readonly referencedEntriesByKind: ReadonlyMap<ReferenceType, Map<string, string[]>>

  private readonly componentStateSorted: Map<string, string[]>

  private readonly namedControlsSorted: Map<string, string[]>

  private readonly controlNamesByComponent: Map<string, string[]>

  private readonly incomingPropertiesSorted: Map<string, string[]>

  private readonly consumedPropertiesSorted: Map<string, string[]>

  private readonly componentDocsByName: Map<string, IDocs>

  private readonly entryDocsByKind: ReadonlyMap<ReferenceType, Map<string, IDocs>>

  public constructor(contributions: readonly IIndexContribution[]) {
    const components = new Set<string>()
    const tagProps = new Map<string, Set<string>>()
    const usedTags = new Map<string, Set<string>>()
    const componentState = new Map<string, Set<string>>()
    const entryParameters = new Map<string, Set<string>>()
    const namedControls = new Map<string, Set<string>>()
    const byKind = new Map<ReferenceType, Map<string, Set<string>>>(
      REFERENCE_TYPES.map((kind) => [kind, new Map<string, Set<string>>()]),
    )
    const referrersByKind = new Map<ReferenceType, Map<string, Set<string>>>(
      REFERENCE_TYPES.map((kind) => [kind, new Map<string, Set<string>>()]),
    )
    const componentDocs = new Map<string, IDocs>()
    const entryDocsByKind = new Map<ReferenceType, Map<string, IDocs>>(
      REFERENCE_TYPES.map((kind) => [kind, new Map<string, IDocs>()]),
    )

    for (const c of contributions) {
      for (const name of c.components) {
        components.add(name)
      }

      mergeRecord(c.tagProperties, tagProps)
      mergeRecord(c.usedTags, usedTags)
      mergeRecord(c.componentState, componentState)
      mergeRecord(c.entryParameters, entryParameters)
      mergeRecord(c.namedControls, namedControls)
      mergeDocsRecord(c.componentDocs, componentDocs)

      for (const kind of REFERENCE_TYPES) {
        mergeRecord(c.references[kind], byKind.get(kind)!)
        mergeRecord(c.entryReferrers[kind], referrersByKind.get(kind)!)
        mergeDocsRecord(c.entryDocs[kind], entryDocsByKind.get(kind)!)
      }
    }

    this.componentDocsByName = componentDocs
    this.entryDocsByKind = entryDocsByKind

    this.componentSet = components
    this.componentsSorted = sortedKeysOf(components)
    this.tagPropsSorted = sortedValuesOf(tagProps)
    this.usedTagsByComponent = sortedValuesOf(usedTags)
    this.componentStateSorted = sortedValuesOf(componentState)
    this.namedControlsSorted = sortedValuesOf(namedControls)
    this.controlNamesByComponent = controlNamesOf(namedControls)
    this.tables = new Map(REFERENCE_TYPES.map((kind) => [kind, toTable(byKind.get(kind)!)]))
    this.referrersByKind = new Map(REFERENCE_TYPES.map((kind) => [kind, sortedValuesOf(referrersByKind.get(kind)!)]))
    this.referencedEntriesByKind = new Map(
      REFERENCE_TYPES.map((kind) => [kind, referencedEntriesOf(referrersByKind.get(kind)!)]),
    )
    // Built last: both pools resolve named-control navigation against the merged
    // namedControls table above, so they need the index's own lookups in place.
    this.incomingPropertiesSorted = this.buildIncomingProperties(tagProps)
    this.consumedPropertiesSorted = this.buildConsumedProperties(componentState, entryParameters)
  }

  public componentTags(): readonly string[] {
    return this.componentsSorted
  }

  public isComponent(name: string): boolean {
    return this.componentSet.has(name)
  }

  public tagProperties(tag: string): readonly string[] {
    return this.tagPropsSorted.get(tag) ?? []
  }

  public names(kind: ReferenceType): readonly string[] {
    return this.table(kind).namesSorted
  }

  public entries(kind: ReferenceType, name: string): readonly string[] {
    return this.table(kind).entriesSorted.get(name) ?? []
  }

  public hasName(kind: ReferenceType, name: string): boolean {
    return this.table(kind).byName.has(name)
  }

  public hasEntry(kind: ReferenceType, name: string, entry: string): boolean {
    return Boolean(this.table(kind).byName.get(name)?.has(entry))
  }

  public entryReferrers(kind: ReferenceType, name: string, entry: string): readonly string[] {
    return this.referrersByKind.get(kind)!.get(compositeKey(name, entry)) ?? []
  }

  public isEntryUsed(kind: ReferenceType, name: string, entry: string): boolean {
    return (this.referrersByKind.get(kind)!.get(compositeKey(name, entry))?.length ?? 0) > 0
  }

  public componentDocs(name: string): IDocs | undefined {
    return this.componentDocsByName.get(name)
  }

  public entryDocs(kind: ReferenceType, name: string, entry: string): IDocs | undefined {
    return this.entryDocsByKind.get(kind)!.get(compositeKey(name, entry))
  }

  public componentProperties(component: string): readonly string[] {
    const props = this.tagPropsSorted.get(component) ?? []
    const state = this.componentStateSorted.get(component) ?? []

    if (state.length === 0) {
      return props
    }

    if (props.length === 0) {
      return state
    }

    return [...new Set([...props, ...state])].sort()
  }

  public controlTags(component: string, controlName: string): readonly string[] {
    return this.namedControlsSorted.get(compositeKey(component, controlName)) ?? []
  }

  public controlNames(component: string): readonly string[] {
    return this.controlNamesByComponent.get(component) ?? []
  }

  public usedTags(component: string): readonly string[] {
    return this.usedTagsByComponent.get(component) ?? []
  }

  public resolveOverrideChain(starts: Iterable<string>, segments: readonly string[]): OverrideChainResult {
    let current = new Set<string>(starts)

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const controls = new Set<string>()

      for (const component of current) {
        for (const tag of this.controlTags(component, segment)) {
          controls.add(tag)
        }
      }

      const hasTag = [...current].some((component) => this.usedTags(component).includes(segment))
      const isLast = i === segments.length - 1

      if (controls.size > 0 && hasTag) {
        return { status: "ambiguous", segment }
      }

      if (isLast) {
        if (controls.size === 0 && !hasTag) {
          return { status: "unknown", segment }
        }

        return { status: "resolved" }
      }

      if (controls.size === 0) {
        return { status: "unknown", segment }
      }

      current = controls
    }

    return { status: "unknown", segment: "" }
  }

  public referencedEntries(kind: ReferenceType, name: string): readonly string[] {
    return this.referencedEntriesByKind.get(kind)!.get(name) ?? []
  }

  public incomingProperties(component: string): readonly string[] {
    return this.incomingPropertiesSorted.get(component) ?? []
  }

  public consumedProperties(component: string): readonly string[] {
    return this.consumedPropertiesSorted.get(component) ?? []
  }

  public resolveControlChain(starts: Iterable<string>, segments: readonly string[]): Set<string> {
    let current = new Set<string>(starts)

    for (const segment of segments) {
      const next = new Set<string>()

      for (const component of current) {
        for (const tag of this.controlTags(component, segment)) {
          next.add(tag)
        }
      }

      current = next

      if (current.size === 0) {
        break
      }
    }

    return current
  }

  private buildIncomingProperties(tagProps: ReadonlyMap<string, ReadonlySet<string>>): Map<string, string[]> {
    const byComponent = new Map<string, Set<string>>()

    for (const [tag, attrs] of tagProps) {
      for (const attr of attrs) {
        const { prefix, path } = splitComponentPrefix(attr)
        const segments = prefix ? prefix.split(COMPONENT_NAME_SEGMENT_SEPARATOR).filter(Boolean) : []

        for (const target of this.resolveControlChain([tag], segments)) {
          let paths = byComponent.get(target)

          if (!paths) {
            paths = new Set<string>()
            byComponent.set(target, paths)
          }

          paths.add(path)
        }
      }
    }

    return sortedValuesOf(byComponent)
  }

  private buildConsumedProperties(
    componentState: ReadonlyMap<string, ReadonlySet<string>>,
    entryParameters: ReadonlyMap<string, ReadonlySet<string>>,
  ): Map<string, string[]> {
    const byComponent = new Map<string, Set<string>>()

    for (const [component, paths] of componentState) {
      byComponent.set(component, new Set(paths))
    }

    for (const [entry, params] of entryParameters) {
      const referrers = this.referrersByKind.get("dictionary")!.get(entry) ?? []

      for (const param of params) {
        const { prefix, path } = splitComponentPrefix(param)
        const segments = prefix ? prefix.split(COMPONENT_NAME_SEGMENT_SEPARATOR).filter(Boolean) : []

        for (const target of this.resolveControlChain(referrers, segments)) {
          let paths = byComponent.get(target)

          if (!paths) {
            paths = new Set<string>()
            byComponent.set(target, paths)
          }

          paths.add(path)
        }
      }
    }

    return sortedValuesOf(byComponent)
  }

  private table(kind: ReferenceType): ReferenceTable {
    return this.tables.get(kind)!
  }
}

function referencedEntriesOf(referrers: ReadonlyMap<string, Set<string>>): Map<string, string[]> {
  const byName = new Map<string, Set<string>>()

  for (const key of referrers.keys()) {
    const [name, entry] = splitCompositeKey(key)
    let entries = byName.get(name)

    if (!entries) {
      entries = new Set<string>()
      byName.set(name, entries)
    }

    entries.add(entry)
  }

  return sortedValuesOf(byName)
}

function controlNamesOf(namedControls: ReadonlyMap<string, Set<string>>): Map<string, string[]> {
  const byComponent = new Map<string, Set<string>>()

  for (const key of namedControls.keys()) {
    const [component, controlName] = splitCompositeKey(key)
    let names = byComponent.get(component)

    if (!names) {
      names = new Set<string>()
      byComponent.set(component, names)
    }

    names.add(controlName)
  }

  return sortedValuesOf(byComponent)
}

function toTable(byName: Map<string, Set<string>>): ReferenceTable {
  return { byName, namesSorted: [...byName.keys()].sort(), entriesSorted: sortedValuesOf(byName) }
}

function mergeDocsRecord(source: Record<string, IDocs>, target: Map<string, IDocs>): void {
  for (const key in source) {
    const existing = target.get(key)
    target.set(key, existing ? mergeDocs(existing, source[key]) : source[key])
  }
}

function mergeRecord(source: Record<string, string[]>, target: Map<string, Set<string>>): void {
  for (const key in source) {
    let set = target.get(key)

    if (!set) {
      set = new Set<string>()
      target.set(key, set)
    }

    for (const value of source[key]) {
      set.add(value)
    }
  }
}

function sortedKeysOf(set: ReadonlySet<string>): string[] {
  return [...set].sort()
}

function sortedValuesOf(source: ReadonlyMap<string, Set<string>>): Map<string, string[]> {
  const result = new Map<string, string[]>()

  for (const [key, set] of source) {
    result.set(key, [...set].sort())
  }

  return result
}
