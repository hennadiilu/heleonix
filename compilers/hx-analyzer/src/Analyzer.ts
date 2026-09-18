import path from "node:path"
import { ComponentCompiler } from "@heleonix/hx-compiler-components"
import { ConfigCompiler } from "@heleonix/hx-compiler-configs"
import { DictionaryCompiler } from "@heleonix/hx-compiler-dictionaries"
import { StyleCompiler } from "@heleonix/hx-compiler-styles"
import { ThemeCompiler } from "@heleonix/hx-compiler-themes"
import {
  ACTION_ATTRIBUTE,
  BUILTIN_TAGS,
  EXT_CONFIG,
  EXT_DICTIONARY,
  EXT_STYLE,
  EXT_TEMPLATE,
  EXT_THEME,
  NAME_ATTRIBUTE,
  ROOT_TAG,
  collectControlNames,
  extractParameters,
  flattenThemeTokens,
  parseBindingExpression,
  parseRuleKey,
} from "@heleonix/hx-language"
import type {
  IBindingExpression,
  IComponentDefinition,
  IComponentHeader,
  IComponentProperty,
  IComponentUsage,
  IConfigEntryDefinition,
  IDictionaryEntryDefinition,
  IMetaDocument,
  IQualifierDefinition,
  IStyleDefinition,
} from "@heleonix/hx-language"
import { Diagnostics } from "./Diagnostics"
import { locateThemeToken } from "./locateThemeToken"
import type { IAnalyzerFile } from "./IAnalyzerFile"
import type { IComponentInfo } from "./IComponentInfo"
import type { IThemeTokenLocation } from "./IThemeTokenLocation"
import type { IDiagnostic } from "./IDiagnostic"
import type { IDiscoveredClass } from "./IDiscoveredClass"
import type { IDiscoveredComponent } from "./IDiscoveredComponent"
import type { IDiscoveredQualifier } from "./IDiscoveredQualifier"
import type { IMemberType } from "./IMemberType"
import type { IConverterActionInfo } from "./IConverterActionInfo"
import type { ITypeProgramHost } from "./ITypeProgramHost"
import { TypeResolver } from "./TypeResolver"
import type { ITypeRequest } from "./TypeResolver"

// Namespace separator of dotted reference paths (`Buttons.save`).
const ENTRY_SEPARATOR = "."

// The builtin tag that runs an action; its `action` attribute names the action.
const EXECUTE_TAG = "Execute"

// The owner kind passed for action arguments (mutable params are in-out).
const ACTION_OWNER = "action"

// A static action name (a bare identifier); anything else is a dynamic value.
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

interface IFileState {
  file: IAnalyzerFile
  dirty: boolean
  facts?: IFileFacts
}

interface IFileFacts {
  definition?: IComponentDefinition
  header?: IComponentHeader
  dictionaryEntries?: IDictionaryEntryDefinition
  configEntries?: IConfigEntryDefinition
  // Theme files: this partial's flattened token space (dot-path -> value).
  themeTokens?: Record<string, string>
  // Theme files: each token's leaf declaration position in this partial's source.
  themeTokenLocations?: Record<string, { line: number; character: number; length: number }>
  // Style files: every `{...}` binding source in the style, by kind (theme
  // tokens, state reads, dictionary/config references) - collected from rule
  // keys (qualifier args), declaration values and keyframe values.
  styleBindings?: IStyleBindings
  // Style files: the `@hx-style(for: ...)` scope paths (each split into segments).
  scopePaths?: string[][]
  compileError?: IDiagnostic
}

interface IStyleBindings {
  theme: string[]
  state: string[]
  dictionary: string[]
  config: string[]
}

interface IDeclared {
  members: Map<string, IMemberType>
  present: boolean
  resolvable: boolean
  open: boolean
}

interface IIndex {
  components: Set<string>
  declared: Map<string, IDeclared>
  // Hx name -> resolved param members from discovered TS classes. `null`
  // marks a header-declared converter whose params are not type-checked (name
  // resolution only) - it skips argument validation until it migrates to a
  // class. An empty array means a class that genuinely takes no params.
  converters: Map<string, IMemberType[] | null>
  actions: Map<string, IMemberType[] | null>
  dictionaries: Map<string, Set<string>>
  configs: Map<string, IConfigEntryDefinition[]>
  // The merged theme token space (workspace partials + dependency meta): the
  // `{$...}`-addressable dot-path -> leaf value.
  themeTokens: Map<string, string>
  // Component name -> every control name in its workspace definition tree, for
  // resolving `@hx-style(for: ...)` scope segments.
  controlNames: Map<string, Set<string>>
  diagnostics: IDiagnostic[]
}

export class Analyzer {
  private readonly files = new Map<string, IFileState>()

  private readonly metaComponents = new Map<
    string,
    { members: Map<string, IMemberType>; open: boolean; docs?: string }
  >()

  // Control names delivered per component by dependency meta (any source), so
  // scope paths over externally-sourced components validate like workspace ones.
  private readonly metaControlNames = new Map<string, Set<string>>()

  private readonly metaConverters = new Map<string, IMemberType[]>()

  private readonly metaActions = new Map<string, IMemberType[]>()

  // Theme tokens delivered by dependencies (`hx.meta.json`): path -> value.
  private readonly metaThemeTokens = new Map<string, string>()

  // Style-qualifier contracts delivered by dependencies (`hx.meta.json`).
  private readonly metaQualifiers = new Map<string, IQualifierDefinition>()

  // Style qualifiers found by the most recent class scan, retained for editor queries.
  private discoveredQualifiers: IDiscoveredQualifier[] = []

  private typeProgramHost?: ITypeProgramHost

  // One resolver per host so its incremental `oldProgram` survives across
  // analyses - the hot path when the language server re-analyzes on each edit.
  private typeResolver?: TypeResolver

  // The most recent class scan, retained so editor features (completion, hover,
  // go-to-implementation) can query converter/action locations between analyses.
  private discovered: IDiscoveredClass[] = []

  // Programmatic components (classes extending `Component<TProps, TEvents>`) from
  // the most recent scan; their contracts feed the component index.
  private discoveredComponents: IDiscoveredComponent[] = []

  // The most recent component contracts (workspace + native), retained so the
  // editor can offer tag/prop completion and hover between analyses.
  private componentInfos = new Map<string, IComponentInfo>()

  public setTypeProgramHost(host: ITypeProgramHost | undefined): void {
    this.typeProgramHost = host
    this.typeResolver = host ? new TypeResolver(host) : undefined
  }

  public setFile(file: IAnalyzerFile): void {
    this.files.set(file.path, { file, dirty: true })
  }

  public removeFile(path: string): void {
    this.files.delete(path)
  }

  public addMeta(meta: IMetaDocument): void {
    for (const entry of meta.components ?? []) {
      const existing = this.metaComponents.get(entry.name) ?? { members: new Map<string, IMemberType>(), open: false }

      for (const member of [...(entry.props ?? []), ...(entry.events ?? [])]) {
        existing.members.set(member.name, member)
      }

      existing.open ||= entry.open ?? false
      existing.docs ??= entry.docs
      this.metaComponents.set(entry.name, existing)

      if (entry.controls && entry.controls.length > 0) {
        const controls = this.metaControlNames.get(entry.name) ?? new Set<string>()

        for (const control of entry.controls) {
          controls.add(control)
        }

        this.metaControlNames.set(entry.name, controls)
      }
    }

    for (const entry of meta.converters ?? []) {
      this.metaConverters.set(entry.name, entry.params)
    }

    for (const entry of meta.actions ?? []) {
      this.metaActions.set(entry.name, entry.params)
    }

    for (const [path, value] of Object.entries(meta.themeTokens ?? {})) {
      this.metaThemeTokens.set(path, value)
    }

    for (const entry of meta.qualifiers ?? []) {
      this.metaQualifiers.set(entry.name, entry)
    }
  }

  public converters(): IConverterActionInfo[] {
    return this.converterActionInfos("Converter", this.metaConverters)
  }

  public actions(): IConverterActionInfo[] {
    return this.converterActionInfos("Action", this.metaActions)
  }

  public components(): IComponentInfo[] {
    return [...this.componentInfos.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  public qualifiers(): IQualifierDefinition[] {
    const byName = new Map<string, IQualifierDefinition>(this.metaQualifiers)

    for (const found of this.discoveredQualifiers) {
      if (found.hasHxName) {
        byName.set(found.name, { name: found.name, args: found.args })
      }
    }

    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  public themeTokens(): Map<string, string> {
    const tokens = new Map<string, string>(this.metaThemeTokens)

    for (const state of this.files.values()) {
      for (const [tokenPath, value] of Object.entries(state.facts?.themeTokens ?? {})) {
        tokens.set(tokenPath, value)
      }
    }

    return tokens
  }

  public themeTokenLocations(): Map<string, IThemeTokenLocation> {
    const locations = new Map<string, IThemeTokenLocation>()

    for (const state of this.files.values()) {
      for (const [tokenPath, location] of Object.entries(state.facts?.themeTokenLocations ?? {})) {
        locations.set(tokenPath, { file: state.file.path, ...location })
      }
    }

    return locations
  }

  public controlNames(): Map<string, string[]> {
    const names = new Map<string, Set<string>>()

    for (const [name, controls] of this.metaControlNames) {
      names.set(name, new Set(controls))
    }

    for (const state of this.files.values()) {
      const definition = state.facts?.definition

      if (!definition) {
        continue
      }

      const controls = names.get(state.file.name) ?? new Set<string>()

      for (const control of collectControlNames(definition.children ?? [])) {
        controls.add(control)
      }

      names.set(state.file.name, controls)
    }

    return new Map([...names].map(([name, controls]) => [name, [...controls]]))
  }

  public async analyze(): Promise<IDiagnostic[]> {
    await this.compileDirty()

    const index = this.buildIndex()

    this.discoverClasses(index)
    this.resolveHeaderTypes(index)

    const diagnostics = [...index.diagnostics]
    const boundAtUsage = this.collectBoundAtUsage()

    for (const state of this.files.values()) {
      const facts = state.facts

      if (!facts) {
        continue
      }

      if (facts.compileError) {
        diagnostics.push(facts.compileError)

        continue
      }

      if (facts.definition?.children) {
        this.diagnoseUsages(facts.definition.children, state.file.path, index, diagnostics)
        diagnoseStateInference(facts.definition, index, boundAtUsage, state.file.path, diagnostics)
      }
    }

    this.diagnoseThemeReferences(index, diagnostics)
    this.diagnoseStyleReferences(index, diagnostics)
    this.diagnoseStyleScopes(index, diagnostics)
    this.diagnoseStyleState(index, boundAtUsage, diagnostics)

    this.snapshotComponents(index)

    return diagnostics
  }

  private snapshotComponents(index: IIndex): void {
    const docs = new Map<string, string>()

    for (const [name, contract] of this.metaComponents) {
      if (contract.docs) {
        docs.set(name, contract.docs)
      }
    }

    for (const state of this.files.values()) {
      const summary = state.facts?.header?.docs

      if (summary) {
        docs.set(state.file.name, summary)
      }
    }

    // Programmatic components carry docs and a source location (class file).
    const locations = new Map<string, IDiscoveredComponent>()

    for (const component of this.discoveredComponents) {
      locations.set(component.name, component)

      if (component.docs) {
        docs.set(component.name, component.docs)
      }
    }

    this.componentInfos = new Map()

    for (const name of index.components) {
      const declared = index.declared.get(name)
      const info: IComponentInfo = {
        name,
        open: declared?.open ?? false,
        members: [...(declared?.members.values() ?? [])],
      }

      const summary = docs.get(name)

      if (summary) {
        info.docs = summary
      }

      const location = locations.get(name)

      if (location) {
        info.file = location.file
        info.line = location.line
        info.character = location.character
      }

      this.componentInfos.set(name, info)
    }
  }

  private collectBoundAtUsage(): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>()

    const walk = (usages: readonly IComponentUsage[]): void => {
      for (const usage of usages) {
        for (const property of usage.properties ?? []) {
          if (!property.name.includes(".") && property.name !== NAME_ATTRIBUTE) {
            const slots = result.get(usage.tag) ?? new Set<string>()

            slots.add(property.name)
            result.set(usage.tag, slots)
          }
        }

        if (usage.children) {
          walk(usage.children)
        }

        for (const override of usage.overrides ?? []) {
          if (override.children) {
            walk(override.children)
          }
        }
      }
    }

    for (const state of this.files.values()) {
      if (state.facts?.definition?.children) {
        walk(state.facts.definition.children)
      }
    }

    return result
  }

  private async compileDirty(): Promise<void> {
    for (const state of this.files.values()) {
      if (!state.dirty) {
        continue
      }

      state.dirty = false
      state.facts = await compileFacts(state.file)
    }
  }

  private buildIndex(): IIndex {
    const index: IIndex = {
      components: new Set(),
      declared: new Map(),
      converters: new Map(),
      actions: new Map(),
      dictionaries: new Map(),
      configs: new Map(),
      themeTokens: new Map(this.metaThemeTokens),
      controlNames: new Map(),
      diagnostics: [],
    }

    // Meta components carry pre-resolved member contracts (from a dependency's
    // build): they are recognized as tags and their props are validated here,
    // without re-resolving the dependency's TypeScript sources.
    for (const [name, contract] of this.metaComponents) {
      index.components.add(name)

      const declared = getDeclared(index, name)

      declared.present = true
      declared.open = contract.open

      for (const [memberName, member] of contract.members) {
        declared.members.set(memberName, member)
      }
    }

    for (const [name, controls] of this.metaControlNames) {
      index.controlNames.set(name, new Set(controls))
    }

    for (const [name, params] of this.metaConverters) {
      index.converters.set(name, params)
    }

    for (const [name, params] of this.metaActions) {
      index.actions.set(name, params)
    }

    for (const state of this.files.values()) {
      const facts = state.facts

      if (!facts || facts.compileError) {
        continue
      }

      const name = state.file.name

      if (facts.definition) {
        index.components.add(name)

        const controls = index.controlNames.get(name) ?? new Set<string>()

        for (const control of collectControlNames(facts.definition.children ?? [])) {
          controls.add(control)
        }

        index.controlNames.set(name, controls)
      }

      if (facts.dictionaryEntries) {
        const keys = index.dictionaries.get(name) ?? new Set()

        for (const key of Object.keys(facts.dictionaryEntries)) {
          keys.add(key)
        }

        index.dictionaries.set(name, keys)
      }

      if (facts.configEntries) {
        const entries = index.configs.get(name) ?? []

        entries.push(facts.configEntries)
        index.configs.set(name, entries)
      }

      for (const [tokenPath, value] of Object.entries(facts.themeTokens ?? {})) {
        index.themeTokens.set(tokenPath, value)
      }
    }

    return index
  }

  private discoverClasses(index: IIndex): void {
    const resolver = this.typeResolver

    if (!resolver) {
      return
    }

    this.discovered = resolver.discover()
    this.discoveredQualifiers = resolver.qualifiers()
    this.discoveredComponents = resolver.components()

    for (const found of this.discovered) {
      if (!found.hasHxName) {
        index.diagnostics.push(
          diagnostic(Diagnostics.missingHxName, found.file, found.className, found.className, found.base.toLowerCase()),
        )

        continue
      }

      const pool = found.base === "Converter" ? index.converters : index.actions

      pool.set(found.name, found.params)
    }

    for (const qualifier of this.discoveredQualifiers) {
      if (!qualifier.hasHxName) {
        index.diagnostics.push(
          diagnostic(
            Diagnostics.missingHxName,
            qualifier.file,
            qualifier.className,
            qualifier.className,
            "style qualifier",
          ),
        )
      }
    }

    // Programmatic components are recognized tags; their props/events form a
    // closed contract (like a `*.hxm` frontmatter), validated only when declared
    // so a contract-less class stays gradual rather than rejecting every prop.
    for (const component of this.discoveredComponents) {
      if (!component.hasHxName) {
        index.diagnostics.push(
          diagnostic(Diagnostics.missingHxName, component.file, component.className, component.className, "component"),
        )

        continue
      }

      index.components.add(component.name)

      if (component.props.length === 0 && component.events.length === 0) {
        continue
      }

      const declared = getDeclared(index, component.name)

      declared.present = true
      declared.resolvable = true

      for (const member of [...component.props, ...component.events]) {
        declared.members.set(member.name, member)
      }
    }
  }

  private converterActionInfos(base: "Converter" | "Action", meta: Map<string, IMemberType[]>): IConverterActionInfo[] {
    const byName = new Map<string, IConverterActionInfo>()

    for (const [name, params] of meta) {
      byName.set(name, { name, params })
    }

    // Discovered classes win over meta entries of the same name and add a
    // source location + docs for go-to-implementation and hover.
    for (const found of this.discovered) {
      if (found.hasHxName && found.base === base) {
        const info: IConverterActionInfo = {
          name: found.name,
          params: found.params,
          file: found.file,
          line: found.line,
          character: found.character,
        }

        if (found.docs) {
          info.docs = found.docs
        }

        byName.set(found.name, info)
      }
    }

    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  private resolveHeaderTypes(index: IIndex): void {
    const resolver = this.typeResolver

    if (!resolver) {
      return
    }

    const requests: ITypeRequest[] = []
    const owners = new Map<string, { name: string; kind: "props" | "events"; file: string; text: string }>()

    for (const state of this.files.values()) {
      const facts = state.facts

      if (!facts || facts.compileError || !facts.header) {
        continue
      }

      const dir = path.dirname(state.file.path)

      for (const kind of ["props", "events"] as const) {
        const text = facts.header[kind]

        if (!text) {
          continue
        }

        const id = `${state.file.path}|${kind}`

        requests.push({ id, dir, typeText: text })
        owners.set(id, { name: state.file.name, kind, file: state.file.path, text })
      }
    }

    if (requests.length === 0) {
      return
    }

    const resolved = resolver.resolve(requests)

    for (const [id, owner] of owners) {
      const declared = getDeclared(index, owner.name)

      declared.present = true

      const result = resolved.get(id)

      if (!result || !result.resolved) {
        declared.resolvable = false
        index.diagnostics.push(diagnostic(Diagnostics.unresolvedPropsType, owner.file, owner.text, owner.name))

        continue
      }

      for (const member of result.members) {
        declared.members.set(member.name, member)

        if (member.isFunction && owner.kind === "props") {
          index.diagnostics.push(diagnostic(Diagnostics.functionProp, owner.file, member.name, member.name, owner.name))
        }
      }
    }
  }

  private diagnoseUsages(
    usages: readonly IComponentUsage[],
    file: string,
    index: IIndex,
    diagnostics: IDiagnostic[],
  ): void {
    for (const usage of usages) {
      if (!BUILTIN_TAGS.has(usage.tag) && !index.components.has(usage.tag)) {
        diagnostics.push(diagnostic(Diagnostics.unknownComponent, file, usage.tag, usage.tag))
      }

      if (usage.tag === EXECUTE_TAG) {
        this.diagnoseExecute(usage, file, index, diagnostics)
      } else {
        const declared = index.declared.get(usage.tag)

        for (const property of usage.properties ?? []) {
          this.diagnoseBinding(property.binding, file, index, diagnostics)

          if (declared?.present && declared.resolvable) {
            diagnoseProp(property, declared, usage.tag, file, index, diagnostics)
          }
        }
      }

      for (const override of usage.overrides ?? []) {
        this.diagnoseOverride(override, file, index, diagnostics)
      }

      if (usage.children) {
        this.diagnoseUsages(usage.children, file, index, diagnostics)
      }
    }
  }

  private diagnoseOverride(
    override: { target: string; binding?: { type: string; value: string }; children?: IComponentUsage[] },
    file: string,
    index: IIndex,
    diagnostics: IDiagnostic[],
  ): void {
    const binding = override.binding

    // A bare name resolves directly to a component; dictionary/config forms
    // resolve through their entry values (validated as ordinary references).
    if (binding) {
      if (binding.type === "state" && binding.value && !index.components.has(binding.value)) {
        diagnostics.push(
          diagnostic(Diagnostics.unknownOverrideComponent, file, binding.value, binding.value, override.target),
        )
      } else if (binding.type !== "state") {
        this.diagnoseBinding(binding, file, index, diagnostics)
      }
    }

    if (override.children) {
      this.diagnoseUsages(override.children, file, index, diagnostics)
    }
  }

  private diagnoseBinding(
    binding: { type: string; value: string; converters?: string[] },
    file: string,
    index: IIndex,
    diagnostics: IDiagnostic[],
  ): void {
    if (binding.converters) {
      this.diagnoseConverters(binding.converters, file, index, diagnostics)
    }

    switch (binding.type) {
      case "dictionary": {
        if (!resolveEntryRef(binding.value, index.dictionaries)) {
          diagnostics.push(diagnostic(Diagnostics.unknownDictionaryEntry, file, `@${binding.value}`, binding.value))
        }

        break
      }
      case "config": {
        if (!resolveConfigRef(binding.value, index.configs)) {
          diagnostics.push(diagnostic(Diagnostics.unknownConfigEntry, file, `#${binding.value}`, binding.value))
        }

        break
      }
    }
  }

  private diagnoseConverters(
    converters: readonly string[],
    file: string,
    index: IIndex,
    diagnostics: IDiagnostic[],
  ): void {
    for (const segment of converters) {
      const match = /^([\w$]+)\s*(?:\(([\s\S]*)\))?\s*$/.exec(segment.trim())

      if (!match) {
        continue
      }

      const name = match[1]

      if (!index.converters.has(name)) {
        diagnostics.push(diagnostic(Diagnostics.unknownConverter, file, name, name))

        continue
      }

      this.diagnoseNamedArgs(
        match[2] ?? "",
        index.converters.get(name) ?? null,
        name,
        "converter",
        Diagnostics.unknownConverterArgument,
        Diagnostics.missingConverterArgument,
        file,
        index,
        diagnostics,
      )
    }
  }

  private diagnoseNamedArgs(
    argText: string,
    members: IMemberType[] | null,
    ownerName: string,
    ownerKind: string,
    unknownArg: (typeof Diagnostics)[keyof typeof Diagnostics],
    missingArg: (typeof Diagnostics)[keyof typeof Diagnostics],
    file: string,
    index: IIndex,
    diagnostics: IDiagnostic[],
  ): void {
    const pairs = parseNamedArgs(argText).map((argument) => ({
      name: argument.name,
      binding: parseBindingExpression(argument.value),
    }))

    this.diagnoseArgBindings(pairs, members, ownerName, ownerKind, unknownArg, missingArg, file, index, diagnostics)
  }

  private diagnoseArgBindings(
    pairs: readonly { name: string; binding: IBindingExpression }[],
    members: IMemberType[] | null,
    ownerName: string,
    ownerKind: string,
    unknownArg: (typeof Diagnostics)[keyof typeof Diagnostics],
    missingArg: (typeof Diagnostics)[keyof typeof Diagnostics],
    file: string,
    index: IIndex,
    diagnostics: IDiagnostic[],
  ): void {
    const byName = members ? new Map(members.map((member) => [member.name, member])) : undefined
    const provided = new Set<string>()
    const ownerDesc = `${ownerKind} '${ownerName}'`

    for (const { name, binding } of pairs) {
      provided.add(name)
      this.diagnoseBinding(binding, file, index, diagnostics)

      if (!byName) {
        continue
      }

      const member = byName.get(name)

      if (!member) {
        diagnostics.push(diagnostic(unknownArg, file, name, name, ownerName))

        continue
      }

      // A mutable action parameter is in-out: it writes back, so it must bind a
      // writable state/prop path. `readonly` parameters are inputs (any source).
      if (ownerKind === ACTION_OWNER && !member.readonly) {
        if (binding.type !== "state" || !binding.value) {
          diagnostics.push(
            diagnostic(Diagnostics.inOutNotWritable, file, name, name, ownerName, displaySource(binding)),
          )
        }

        continue
      }

      diagnoseMemberValue(binding, member, name, ownerDesc, file, index, diagnostics)
    }

    for (const member of members ?? []) {
      if (!member.optional && !provided.has(member.name)) {
        diagnostics.push(diagnostic(missingArg, file, member.name, member.name, ownerName))
      }
    }
  }

  private diagnoseExecute(usage: IComponentUsage, file: string, index: IIndex, diagnostics: IDiagnostic[]): void {
    const properties = usage.properties ?? []
    const actionProp = properties.find((property) => property.name === ACTION_ATTRIBUTE)
    const name = actionProp ? staticName(actionProp.binding) : undefined

    if (!name || !IDENTIFIER.test(name)) {
      return
    }

    if (!index.actions.has(name)) {
      diagnostics.push(diagnostic(Diagnostics.unknownAction, file, name, name))

      return
    }

    const pairs = properties
      .filter((property) => property !== actionProp && property.name !== NAME_ATTRIBUTE)
      .map((property) => ({ name: property.name, binding: property.binding }))

    this.diagnoseArgBindings(
      pairs,
      index.actions.get(name) ?? null,
      name,
      ACTION_OWNER,
      Diagnostics.unknownActionArgument,
      Diagnostics.missingActionArgument,
      file,
      index,
      diagnostics,
    )
  }

  private diagnoseThemeReferences(index: IIndex, diagnostics: IDiagnostic[]): void {
    const aliasGraph = new Map<string, string[]>()
    const tokenFile = new Map<string, string>()

    for (const state of this.files.values()) {
      const facts = state.facts

      if (!facts || facts.compileError) {
        continue
      }

      for (const [tokenPath, value] of Object.entries(facts.themeTokens ?? {})) {
        tokenFile.set(tokenPath, state.file.path)

        const resolved: string[] = []

        for (const ref of themeRefsOf(value)) {
          if (index.themeTokens.has(ref)) {
            resolved.push(ref)
          } else {
            diagnostics.push(diagnostic(Diagnostics.unknownThemeToken, state.file.path, `{$${ref}}`, `{$${ref}}`))
          }
        }

        aliasGraph.set(tokenPath, resolved)
      }

      for (const ref of facts.styleBindings?.theme ?? []) {
        if (!index.themeTokens.has(ref)) {
          diagnostics.push(diagnostic(Diagnostics.unknownThemeToken, state.file.path, `{$${ref}}`, `{$${ref}}`))
        }
      }
    }

    for (const tokenPath of findAliasCycles(aliasGraph)) {
      diagnostics.push(diagnostic(Diagnostics.themeAliasCycle, tokenFile.get(tokenPath) ?? "", tokenPath, tokenPath))
    }
  }

  private diagnoseStyleScopes(index: IIndex, diagnostics: IDiagnostic[]): void {
    for (const state of this.files.values()) {
      const facts = state.facts

      if (!facts || facts.compileError || !facts.scopePaths) {
        continue
      }

      const controls = index.controlNames.get(state.file.name)

      if (!controls) {
        continue
      }

      for (const path of facts.scopePaths) {
        for (const segment of path) {
          if (
            segment !== ROOT_TAG &&
            !controls.has(segment) &&
            !index.components.has(segment) &&
            !BUILTIN_TAGS.has(segment)
          ) {
            diagnostics.push(
              diagnostic(Diagnostics.unknownScopeSegment, state.file.path, segment, segment, path.join(".")),
            )
          }
        }
      }
    }
  }

  private diagnoseStyleState(index: IIndex, boundAtUsage: Map<string, Set<string>>, diagnostics: IDiagnostic[]): void {
    const definitions = new Map<string, IComponentDefinition>()

    for (const state of this.files.values()) {
      if (state.facts?.definition && !state.facts.compileError) {
        definitions.set(state.file.name, state.facts.definition)
      }
    }

    for (const state of this.files.values()) {
      const facts = state.facts

      if (!facts || facts.compileError || !facts.styleBindings) {
        continue
      }

      const definition = definitions.get(state.file.name)

      if (!definition) {
        continue
      }

      const { pool, inferable } = buildComponentPool(definition, index, boundAtUsage)

      if (!inferable) {
        continue
      }

      for (const path of facts.styleBindings.state) {
        if (!pool.has(rootSegment(path))) {
          diagnostics.push(diagnostic(Diagnostics.unknownStateBinding, state.file.path, path, path, state.file.name))
        }
      }
    }
  }

  private diagnoseStyleReferences(index: IIndex, diagnostics: IDiagnostic[]): void {
    for (const state of this.files.values()) {
      const bindings = state.facts?.styleBindings

      if (!bindings || state.facts?.compileError) {
        continue
      }

      for (const value of bindings.dictionary) {
        this.diagnoseBinding({ type: "dictionary", value }, state.file.path, index, diagnostics)
      }

      for (const value of bindings.config) {
        this.diagnoseBinding({ type: "config", value }, state.file.path, index, diagnostics)
      }
    }
  }
}

function themeRefsOf(value: string): string[] {
  const refs: string[] = []

  for (const inner of extractParameters(value)) {
    const binding = parseBindingExpression(inner)

    if (binding.type === "theme") {
      refs.push(binding.value)
    }
  }

  return refs
}

function findAliasCycles(graph: Map<string, string[]>): Set<string> {
  const onCycle = new Set<string>()
  const state = new Map<string, "visiting" | "done">()
  const stack: string[] = []

  const visit = (node: string): void => {
    state.set(node, "visiting")
    stack.push(node)

    for (const next of graph.get(node) ?? []) {
      const seen = state.get(next)

      if (seen === undefined) {
        visit(next)
      } else if (seen === "visiting") {
        for (let i = stack.lastIndexOf(next); i >= 0 && i < stack.length; i++) {
          onCycle.add(stack[i])
        }
      }
    }

    stack.pop()
    state.set(node, "done")
  }

  for (const node of graph.keys()) {
    if (!state.has(node)) {
      visit(node)
    }
  }

  return onCycle
}

function diagnoseStateInference(
  definition: IComponentDefinition,
  index: IIndex,
  boundAtUsage: Map<string, Set<string>>,
  file: string,
  diagnostics: IDiagnostic[],
): void {
  const { pool, inferable, reads } = buildComponentPool(definition, index, boundAtUsage)

  if (!inferable) {
    return
  }

  for (const path of reads) {
    if (!pool.has(rootSegment(path))) {
      diagnostics.push(diagnostic(Diagnostics.unknownStateBinding, file, path, path, definition.tag))
    }
  }
}

function buildComponentPool(
  definition: IComponentDefinition,
  index: IIndex,
  boundAtUsage: Map<string, Set<string>>,
): { pool: Set<string>; inferable: boolean; reads: string[] } {
  const declared = index.declared.get(definition.tag)?.members
  const pool = new Set<string>()
  const writes = new Set<string>()
  const reads: string[] = []

  collectState(definition.children ?? [], pool, writes, reads)

  const inferable = (declared?.size ?? 0) > 0 || writes.size > 0

  for (const name of declared?.keys() ?? []) {
    pool.add(name)
  }

  for (const slot of boundAtUsage.get(definition.tag) ?? []) {
    pool.add(slot)
  }

  for (const slot of writes) {
    pool.add(slot)
  }

  return { pool, inferable, reads }
}

function collectState(
  usages: readonly IComponentUsage[],
  pool: Set<string>,
  writes: Set<string>,
  reads: string[],
): void {
  for (const usage of usages) {
    if (usage.name) {
      pool.add(usage.name)
    }

    for (const property of usage.properties ?? []) {
      const binding = property.binding

      if (binding.type !== "state" || !binding.value) {
        continue
      }

      if (property.name.includes(".") || property.name.includes(":")) {
        // Dotted/control-addressed names (event captures, remote captures) are
        // not data reads: their value is a state slot the component writes.
        writes.add(rootSegment(binding.value))
      } else if (property.name !== NAME_ATTRIBUTE) {
        reads.push(binding.value)
      }
    }

    if (usage.children) {
      collectState(usage.children, pool, writes, reads)
    }

    for (const override of usage.overrides ?? []) {
      if (override.children) {
        collectState(override.children, pool, writes, reads)
      }
    }
  }
}

function rootSegment(path: string): string {
  const match = /^[^.:]+/.exec(path)

  return match ? match[0] : path
}

function diagnoseProp(
  property: IComponentProperty,
  declared: IDeclared,
  tag: string,
  file: string,
  index: IIndex,
  diagnostics: IDiagnostic[],
): void {
  const name = property.name

  // Control-addressed (`ctrl:prop`), dotted event captures (`click.type`) and
  // the framework `name` attribute are not component props.
  if (name === NAME_ATTRIBUTE || name.includes(":") || name.includes(".")) {
    return
  }

  const member = declared.members.get(name)

  if (!member) {
    // Open components (native elements) allow attributes beyond their
    // enumerated contract (`class`, `data-*`, `aria-*`, ...).
    if (!declared.open) {
      diagnostics.push(diagnostic(Diagnostics.unknownProp, file, name, name, tag))
    }

    return
  }

  diagnoseMemberValue(property.binding, member, name, `<${tag}>`, file, index, diagnostics)
}

function diagnoseMemberValue(
  binding: IBindingExpression,
  member: IMemberType,
  memberName: string,
  ownerDesc: string,
  file: string,
  index: IIndex,
  diagnostics: IDiagnostic[],
): void {
  if (binding.converters?.length) {
    return
  }

  const expected = member.kind === "enum" ? "string" : member.kind

  if (expected === "string" || expected === "number" || expected === "boolean") {
    const source = sourceScalarKind(binding, index)

    if (source !== undefined && source !== expected) {
      diagnostics.push(
        diagnostic(
          Diagnostics.valueKindMismatch,
          file,
          sourceSubject(binding),
          displaySource(binding),
          memberName,
          ownerDesc,
          expected,
          source,
        ),
      )

      return
    }
  }

  const bad = outOfEnumValue(binding, member)

  if (bad !== undefined) {
    diagnostics.push(
      diagnostic(Diagnostics.propTypeMismatch, file, bad, bad, memberName, ownerDesc, member.enumValues!.join(" | ")),
    )
  }
}

function staticName(binding: IBindingExpression): string | undefined {
  if (binding.type !== "literal") {
    return undefined
  }

  const value: unknown = safeParse(binding.value)

  return typeof value === "string" ? value.trim() : undefined
}

function outOfEnumValue(binding: IBindingExpression, member: IMemberType): string | undefined {
  if (member.kind !== "enum" || !member.enumValues || binding.type !== "literal") {
    return undefined
  }

  const value: unknown = safeParse(binding.value)

  return typeof value === "string" && !member.enumValues.includes(value) ? value : undefined
}

function sourceScalarKind(binding: IBindingExpression, index: IIndex): "string" | "number" | "boolean" | undefined {
  switch (binding.type) {
    case "literal":
      return scalarOf(safeParse(binding.value))
    case "dictionary":
      return "string"
    case "config":
      return scalarOf(resolveConfigValue(binding.value, index.configs))
    default:
      return undefined
  }
}

function scalarOf(value: unknown): "string" | "number" | "boolean" | undefined {
  const type = typeof value

  return type === "string" || type === "number" || type === "boolean" ? type : undefined
}

function resolveConfigValue(ref: string, index: Map<string, IConfigEntryDefinition[]>): unknown {
  const splitIndex = ref.lastIndexOf(ENTRY_SEPARATOR)

  if (splitIndex <= 0) {
    return undefined
  }

  const key = ref.slice(splitIndex + 1)

  for (const object of index.get(ref.slice(0, splitIndex)) ?? []) {
    if (key in object) {
      return object[key]
    }
  }

  return undefined
}

function sourceSubject(binding: IBindingExpression): string {
  if (binding.type === "literal") {
    const value: unknown = safeParse(binding.value)

    return typeof value === "string" ? value : binding.value
  }

  return displaySource(binding)
}

function displaySource(binding: IBindingExpression): string {
  switch (binding.type) {
    case "literal": {
      const value: unknown = safeParse(binding.value)

      return typeof value === "string" ? `'${value}'` : binding.value
    }
    case "dictionary":
      return `@${binding.value}`
    case "config":
      return `#${binding.value}`
    default:
      return binding.value
  }
}

function parseNamedArgs(input: string): { name: string; value: string }[] {
  const result: { name: string; value: string }[] = []

  for (const argument of splitArguments(input)) {
    const colon = argument.indexOf(":")

    if (colon > 0) {
      result.push({ name: argument.slice(0, colon).trim(), value: argument.slice(colon + 1).trim() })
    }
  }

  return result
}

async function compileFacts(file: IAnalyzerFile): Promise<IFileFacts> {
  try {
    switch (file.ext) {
      case EXT_TEMPLATE: {
        const compiler = new ComponentCompiler()
        const definition = await compiler.compile(file.source, file.dimension, { name: file.name })

        const facts: IFileFacts = { definition }
        const header = compiler.compileHeader(file.source)

        if (header) {
          facts.header = header
        }

        return facts
      }
      case EXT_DICTIONARY: {
        const definition = await new DictionaryCompiler().compile(file.source, file.dimension, { name: file.name })

        return { dictionaryEntries: definition.entries }
      }
      case EXT_CONFIG: {
        const definition = await new ConfigCompiler().compile(file.source, file.dimension, { name: file.name })

        return { configEntries: definition.entries }
      }
      case EXT_THEME: {
        const definition = await new ThemeCompiler().compile(file.source, file.dimension, { name: file.name })
        const themeTokens = flattenThemeTokens(definition.groups)
        const themeTokenLocations: Record<string, { line: number; character: number; length: number }> = {}

        for (const tokenPath of Object.keys(themeTokens)) {
          const location = locateThemeToken(file.source, tokenPath)

          if (location) {
            themeTokenLocations[tokenPath] = location
          }
        }

        return { themeTokens, themeTokenLocations }
      }
      case EXT_STYLE: {
        const definition = await new StyleCompiler().compile(file.source, file.dimension, { name: file.name })

        return { styleBindings: collectStyleBindings(definition), scopePaths: collectScopePaths(definition) }
      }
      default:
        return {}
    }
  } catch (error) {
    const code = (error as { code?: string }).code ?? "HX_ANALYZER_0000"

    return {
      compileError: {
        code,
        severity: "error",
        message: (error as Error).message || code,
        file: file.path,
      },
    }
  }
}

function collectScopePaths(definition: IStyleDefinition): string[][] {
  const seen = new Set<string>()
  const paths: string[][] = []

  for (const key of Object.keys(definition.rules)) {
    for (const usage of parseRuleKey(key)) {
      const forPath = usage.name === "Style" ? usage.args["for"] : undefined

      if (forPath && !seen.has(forPath)) {
        seen.add(forPath)
        paths.push(forPath.split("."))
      }
    }
  }

  return paths
}

function collectStyleBindings(definition: IStyleDefinition): IStyleBindings {
  const buckets: Record<IBindingExpression["type"], Set<string>> = {
    theme: new Set(),
    state: new Set(),
    dictionary: new Set(),
    config: new Set(),
    literal: new Set(),
  }

  const addFrom = (value: string): void => {
    for (const inner of extractParameters(value)) {
      const binding = parseBindingExpression(inner)

      if (binding.value) {
        buckets[binding.type].add(binding.value)
      }
    }
  }

  for (const [key, declarations] of Object.entries(definition.rules)) {
    for (const usage of parseRuleKey(key)) {
      for (const argValue of Object.values(usage.args)) {
        addFrom(argValue)
      }

      if (usage.positional) {
        addFrom(usage.positional)
      }
    }

    for (const value of Object.values(declarations)) {
      addFrom(value)
    }
  }

  for (const frames of Object.values(definition.keyframes ?? {})) {
    for (const declarations of Object.values(frames)) {
      for (const value of Object.values(declarations)) {
        addFrom(value)
      }
    }
  }

  return {
    theme: [...buckets.theme],
    state: [...buckets.state],
    dictionary: [...buckets.dictionary],
    config: [...buckets.config],
  }
}

function getDeclared(index: IIndex, name: string): IDeclared {
  let declared = index.declared.get(name)

  if (!declared) {
    declared = { members: new Map(), present: false, resolvable: true, open: false }
    index.declared.set(name, declared)
  }

  return declared
}

function resolveEntryRef(ref: string, index: Map<string, Set<string>>): boolean {
  const splitIndex = ref.lastIndexOf(ENTRY_SEPARATOR)

  if (splitIndex <= 0) {
    return false
  }

  return index.get(ref.slice(0, splitIndex))?.has(ref.slice(splitIndex + 1)) ?? false
}

function resolveConfigRef(ref: string, index: Map<string, IConfigEntryDefinition[]>): boolean {
  const splitIndex = ref.lastIndexOf(ENTRY_SEPARATOR)

  if (splitIndex <= 0) {
    return false
  }

  const entries = index.get(ref.slice(0, splitIndex))
  const key = ref.slice(splitIndex + 1)

  return entries?.some((object) => key in object) ?? false
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

function diagnostic(
  template: { code: string; severity: IDiagnostic["severity"]; message: string },
  file: string,
  subject: string | undefined,
  ...args: string[]
): IDiagnostic {
  let message = template.message

  args.forEach((arg, index) => {
    message = message.replaceAll(`{${index}}`, arg)
  })

  const result: IDiagnostic = { code: template.code, severity: template.severity, message, file }

  if (subject) {
    result.subject = subject
  }

  return result
}

function splitArguments(input: string): string[] {
  const result: string[] = []
  let depth = 0
  let quoted = false
  let start = 0

  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i)

    if (ch === "'") {
      quoted = !quoted
    } else if (!quoted && ch === "(") {
      depth++
    } else if (!quoted && ch === ")") {
      if (depth > 0) {
        depth--
      }
    } else if (!quoted && depth === 0 && ch === ",") {
      result.push(input.slice(start, i))
      start = i + 1
    }
  }

  result.push(input.slice(start))

  return result.map((part) => part.trim()).filter(Boolean)
}
