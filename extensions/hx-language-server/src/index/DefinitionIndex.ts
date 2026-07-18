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

/** Outcome of resolving a `target:Component` override chain via {@link DefinitionIndex.resolveOverrideChain}. */
export type OverrideChainResult =
  | { status: "resolved" }
  | { status: "ambiguous"; segment: string }
  | { status: "unknown"; segment: string }

/**
 * Aggregated, queryable view of every definition known to the server, merged
 * from all registered sources. Immutable to consumers - it is rebuilt by the
 * {@link DefinitionRegistry} whenever sources change. Name/entry lists are
 * sorted once at construction so completion requests don't re-sort. One
 * {@link ReferenceTable} is built per {@link ReferenceType} (dictionary,
 * config, ...) so adding a reference kind doesn't require new fields/methods.
 */
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

  /** Whether `name` is a component declared by a definition source (not an HTML/builtin tag). */
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

  /** Components that reference `name.entry` of the given kind (`@Name.entry` / `#Name.entry`). */
  public entryReferrers(kind: ReferenceType, name: string, entry: string): readonly string[] {
    return this.referrersByKind.get(kind)!.get(compositeKey(name, entry)) ?? []
  }

  /** Whether `name.entry` of the given kind is referenced anywhere. */
  public isEntryUsed(kind: ReferenceType, name: string, entry: string): boolean {
    return (this.referrersByKind.get(kind)!.get(compositeKey(name, entry))?.length ?? 0) > 0
  }

  /** Docs of a component's doc comment (summary, `@prop`s, ...), from any contributing source. */
  public componentDocs(name: string): IDocs | undefined {
    return this.componentDocsByName.get(name)
  }

  /** Docs of one dictionary/config entry's doc comment. */
  public entryDocs(kind: ReferenceType, name: string, entry: string): IDocs | undefined {
    return this.entryDocsByKind.get(kind)!.get(compositeKey(name, entry))
  }

  /** A component's property pool: attributes parents pass to it plus the state it reads internally. */
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

  /** Tag name(s) of the control declared as `<Tag name="controlName"/>` inside `component`. */
  public controlTags(component: string, controlName: string): readonly string[] {
    return this.namedControlsSorted.get(compositeKey(component, controlName)) ?? []
  }

  /** Names of the controls declared via `name="..."` inside `component`. */
  public controlNames(component: string): readonly string[] {
    return this.controlNamesByComponent.get(component) ?? []
  }

  /** Tag names used directly inside `component`'s definition (override-target candidates). */
  public usedTags(component: string): readonly string[] {
    return this.usedTagsByComponent.get(component) ?? []
  }

  /**
   * Resolves a `target:Component` override chain against the definition(s) in
   * `starts`. Each segment except the last must name a control to descend into;
   * the last may name a control or a used tag. A segment that names both a
   * control and a used tag at the same level is ambiguous; one that names
   * neither is unknown.
   */
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

  /** Entry keys of `name` (of the given kind) that are referenced somewhere, defined or not. */
  public referencedEntries(kind: ReferenceType, name: string): readonly string[] {
    return this.referencedEntriesByKind.get(kind)!.get(name) ?? []
  }

  /**
   * Property paths set on `component` at its usage sites across the workspace
   * (`<Component path="..."/>` and named `<Parent ctrl:path="..."/>` resolved
   * through the named-control chain). This is the pool a state binding inside
   * `component`'s own file reads from (`prop="path"`).
   */
  public incomingProperties(component: string): readonly string[] {
    return this.incomingPropertiesSorted.get(component) ?? []
  }

  /**
   * Property paths `component` reads internally: bare state bindings in its own
   * definition file (`value="path"`) plus the state `{param}` interpolations of
   * the dictionary entries it references (those resolve against its state at
   * runtime). This is the pool of properties callers may set on it
   * (`<Component path="..."/>`).
   */
  public consumedProperties(component: string): readonly string[] {
    return this.consumedPropertiesSorted.get(component) ?? []
  }

  /**
   * Descends a chain of nested `name="..."` controls: starting from `starts`,
   * each segment maps every current component to the tag(s) of its control with
   * that name. Returns the components the chain resolves to (the `starts`
   * themselves when `segments` is empty), or an empty set when a segment names no
   * known control.
   */
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

  /**
   * The consumed pool starts as the component's own state reads and gains the
   * `{param}`s of every dictionary entry the component references. A qualified
   * `{ctrl:path}` parameter reads from a named control of the referrer instead,
   * so its path is attributed to the component(s) that control chain resolves
   * to. Deliberately NOT folded into {@link componentProperties}: dictionary
   * `{param}` validation resolves against that pool, and seeding it with the
   * parameters themselves would make the check vacuous.
   */
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
