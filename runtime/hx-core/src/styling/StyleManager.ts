import {
  EXPRESSION_PATTERN,
  extractParameters,
  parseBindingExpression,
  parseRuleKey,
  parseStyleValue,
  resolveThemeNode,
} from "@heleonix/hx-language"
import type { FQPropertyName, IBindingExpression, IStyleDefinition, IThemeGroup } from "@heleonix/hx-language"
import { Component } from "../components/Component"
import type { BindingEvaluator } from "../bindings/BindingEvaluator"
import type { IState } from "../state/IState"
import type { StateChangedHandler } from "../state/StateChangedHandler"
import type { IBindingScope } from "./qualifiers/IBindingScope"
import type { IKeyframeScope } from "../platform/IKeyframeScope"
import type { IStyleDriver } from "../platform/IStyleDriver"
import type { IStyleEffect } from "../platform/IStyleEffect"
import type { IStyleVariable } from "../platform/IStyleVariable"
import type { IQualifierProvider } from "./qualifiers/IQualifierProvider"
import { StyleDefinitionLoader } from "./StyleDefinitionLoader"
import type { StyleHandle } from "../platform/StyleHandle"
import type { StyleFragment } from "./StyleFragment"
import { ThemeManager } from "../theming/ThemeManager"
import type { IClearable } from "../common/IClearable"
import type { IDisposable } from "../common/IDisposable"
import type { MaybePromise } from "../common/MaybePromise"
import { isThenable } from "../common/isThenable"
import { thenMaybe } from "../common/thenMaybe"

const SCOPE_QUALIFIER = "Style"

const SCOPE_PATH_SEPARATOR = "."

interface AppliedRule {
  key: string
  handle: StyleHandle | undefined
  effects: readonly IStyleEffect[]
}

interface Applied {
  // Whether the style has a `@hx-style(for: ...)` rule, so a newly built
  // descendant can trigger the component to re-resolve its scope and pick it up.
  scoped: boolean
  keyframeKeys: string[]
  rules: AppliedRule[]
  variables: { effect: IStyleEffect; variable: IStyleVariable }[]
  disposers: (() => void)[]
}

export class StyleManager implements IClearable {
  private readonly cache = new Map<string, { handle: StyleHandle; refs: number }>()

  private readonly applied = new Map<Component, Applied>()

  // Every component handed to `apply` and not yet removed, styled or not: a
  // dimension switch can give a component a style it lacked, or take one away.
  private readonly components = new Set<Component>()

  public constructor(
    // A thunk, not the driver itself: a runtime rebuilds its style driver on
    // every start (the web discards its sheet on stop), so the driver must be
    // resolved per use rather than captured once at composition time.
    private readonly driver: () => IStyleDriver,
    private readonly loader: StyleDefinitionLoader,
    private readonly themes: ThemeManager,
    private readonly state: IState,
    private readonly evaluator: BindingEvaluator,
    private readonly qualifiers: IQualifierProvider,
  ) {}

  public async apply(component: Component): Promise<void> {
    this.components.add(component)

    await this.applyOwn(component)

    for (let ancestor = component.parent; ancestor; ancestor = ancestor.parent) {
      if (this.applied.get(ancestor)?.scoped) {
        await this.applyOwn(ancestor)
      }
    }
  }

  public async applyDefinition(component: Component, definition: IStyleDefinition): Promise<void> {
    this.removeApplied(component)

    const record: Applied = { scoped: false, keyframeKeys: [], rules: [], variables: [], disposers: [] }

    this.applied.set(component, record)

    const ownEffect = this.driver().effectFor(component)
    const effects = new Map<Component, IStyleEffect>([[component, ownEffect]])
    const effectFor = (target: Component): IStyleEffect => {
      let effect = effects.get(target)

      if (!effect) {
        effect = this.driver().effectFor(target)
        effects.set(target, effect)
      }

      return effect
    }

    const bindings = this.bindingScopeOf(component)
    const pending: Promise<void>[] = []
    const settle = (work: MaybePromise<void>): void => {
      if (isThenable(work)) {
        pending.push(work)
      }
    }

    const keyframeScope: IKeyframeScope | undefined = definition.keyframes
      ? { scope: definition.name, names: Object.keys(definition.keyframes) }
      : undefined

    if (definition.keyframes && this.driver().composeKeyframe) {
      for (const [name, frames] of Object.entries(definition.keyframes)) {
        const key = `@keyframes ${definition.name} ${name} ${JSON.stringify(frames)}`

        this.acquire(key, () => this.driver().composeKeyframe!(definition.name, name, frames))
        record.keyframeKeys.push(key)
      }
    }

    for (const [signature, declarations] of Object.entries(definition.rules)) {
      const usages = parseRuleKey(signature)
      const scopeUsage = usages.find((usage) => usage.name === SCOPE_QUALIFIER)
      const qualified = scopeUsage ? usages.filter((usage) => usage !== scopeUsage) : usages
      const targets = scopeUsage ? this.resolveScope(component, scopeUsage.args["for"]) : [component]

      record.scoped ||= scopeUsage !== undefined

      if (targets.length === 0) {
        continue
      }

      const fragments = qualified.flatMap((usage) => this.qualifiers.get(usage.name)?.build?.(usage) ?? [])
      const variables = this.declarationVariables(declarations)
      const targetEffects = targets.map(effectFor)

      settle(
        this.applyRule(
          component,
          record,
          bindings,
          { signature, declarations, fragments },
          targetEffects,
          keyframeScope,
        ),
      )

      for (const effect of targetEffects) {
        for (const usage of qualified) {
          const attached = this.qualifiers.get(usage.name)?.attach?.(usage, bindings, effect)

          if (attached) {
            settle(thenMaybe(attached, (disposable) => this.keep(component, record, disposable)))
          }
        }

        for (const variable of variables) {
          settle(this.bindVariable(component, effect, variable, record, bindings))
        }
      }
    }

    for (const variable of this.keyframeVariables(definition)) {
      settle(this.bindVariable(component, ownEffect, variable, record, bindings))
    }

    await Promise.all(pending)
  }

  public clear(): void {
    for (const component of [...this.applied.keys()]) {
      this.removeApplied(component)
    }

    this.components.clear()
    this.cache.clear()
  }

  public remove(component: Component): void {
    this.components.delete(component)

    this.removeApplied(component)
  }

  public async reapply(): Promise<void> {
    for (const component of [...this.components]) {
      await this.applyOwn(component)
    }
  }

  private async applyOwn(component: Component): Promise<void> {
    const definition = await this.resolveDefinition(component.definition.tag)

    if (!this.components.has(component)) {
      return
    }

    if (definition) {
      await this.applyDefinition(component, definition)
    } else {
      this.removeApplied(component)
    }
  }

  private async resolveDefinition(tag: string): Promise<IStyleDefinition | undefined> {
    const definition = await this.loader.loadDefinition(tag)

    if (!definition?.applies) {
      return definition
    }

    const theme = await this.themes.getTheme()

    return theme ? this.expandApplies(definition, theme.groups) : definition
  }

  private removeApplied(component: Component): void {
    const record = this.applied.get(component)

    if (!record) {
      return
    }

    for (const dispose of record.disposers) {
      dispose()
    }

    for (const rule of record.rules) {
      if (rule.handle) {
        for (const effect of rule.effects) {
          effect.removeClass(rule.handle)
        }

        this.release(rule.key)
      }
    }

    for (const key of record.keyframeKeys) {
      this.release(key)
    }

    for (const { effect, variable } of record.variables) {
      effect.removeVariable(variable)
    }

    this.applied.delete(component)
  }

  private resolveScope(component: Component, path: string | undefined): Component[] {
    if (!path) {
      return []
    }

    let current = [component]

    for (const segment of path.split(SCOPE_PATH_SEPARATOR)) {
      const matches: Component[] = []

      for (const node of current) {
        this.collectNamed(node, segment, matches)
      }

      if (matches.length === 0) {
        return []
      }

      current = matches
    }

    return current
  }

  private collectNamed(node: Component, name: string, matches: Component[]): void {
    for (const child of node.children) {
      if (child.usage.name === name) {
        matches.push(child)
      }

      this.collectNamed(child, name, matches)
    }
  }

  // Binding sources resolve relative to the component, through the same
  // evaluator component bindings use; theme tokens are a styling-only source,
  // read from the current theme.
  private bindingScopeOf(component: Component): IBindingScope {
    return {
      resolve: (binding) =>
        binding.type === "theme"
          ? this.resolveThemeToken(binding.value)
          : this.evaluator.resolve(binding, component.fqName),
      subscribe: (binding, handler) =>
        thenMaybe(this.evaluator.collectParameters(binding, component.fqName), (names) =>
          this.subscribe(names, handler),
        ),
    }
  }

  // A media condition cannot read a CSS variable, so the sources in a rule's
  // environment are resolved into it, and the rule recomposes - under the class
  // of its resolved input - whenever a property it reads changes; a dimension
  // switch re-applies the whole style. A rule without sources composes at once.
  private applyRule(
    component: Component,
    record: Applied,
    bindings: IBindingScope,
    rule: { signature: string; declarations: Readonly<Record<string, string>>; fragments: readonly StyleFragment[] },
    effects: readonly IStyleEffect[],
    keyframeScope: IKeyframeScope | undefined,
  ): MaybePromise<void> {
    const entry: AppliedRule = { key: "", handle: undefined, effects }
    let latest = 0

    record.rules.push(entry)

    const recompose = (): MaybePromise<void> => {
      const run = ++latest

      return thenMaybe(this.resolveFragments(rule.fragments, bindings), (fragments) => {
        if (run !== latest || this.applied.get(component) !== record) {
          return
        }

        // The share key is the compose input, not the signature alone: only
        // byte-identical rules share one composed artifact, and a resolved
        // environment is part of it. A style with local keyframes also
        // scope-qualifies the key, since its rules resolve animation references
        // against its own keyframes.
        const key = `${keyframeScope?.scope ?? ""} ${rule.signature} ${JSON.stringify(fragments)} ${JSON.stringify(rule.declarations)}`

        if (key === entry.key) {
          return
        }

        const handle = this.acquire(key, () =>
          this.driver().compose(rule.signature, fragments, rule.declarations, keyframeScope),
        )

        for (const effect of effects) {
          effect.setClass(handle)

          if (entry.handle) {
            effect.removeClass(entry.handle)
          }
        }

        if (entry.handle) {
          this.release(entry.key)
        }

        entry.key = key
        entry.handle = handle
      })
    }

    const subscribing = this.environmentSources(rule.fragments)
      .filter((source) => source.type !== "theme")
      .map((source) =>
        thenMaybe(
          bindings.subscribe(source, () => void recompose()),
          (unsubscribe) => this.keep(component, record, { dispose: unsubscribe }),
        ),
      )
      .filter(isThenable)

    return subscribing.length > 0
      ? Promise.all(subscribing.map((work) => Promise.resolve(work))).then(recompose)
      : recompose()
  }

  private environmentSources(fragments: readonly StyleFragment[]): IBindingExpression[] {
    return fragments.flatMap((fragment) =>
      "environment" in fragment ? extractParameters(fragment.environment).map(parseBindingExpression) : [],
    )
  }

  private resolveFragments(
    fragments: readonly StyleFragment[],
    bindings: IBindingScope,
  ): MaybePromise<readonly StyleFragment[]> {
    if (this.environmentSources(fragments).length === 0) {
      return fragments
    }

    const resolved = fragments.map((fragment) =>
      "environment" in fragment
        ? thenMaybe(this.resolveEnvironment(fragment.environment, bindings), (environment) => ({ environment }))
        : fragment,
    )

    return resolved.some(isThenable)
      ? Promise.all(resolved.map((fragment) => Promise.resolve(fragment)))
      : (resolved as StyleFragment[])
  }

  // An unresolved source stays as written, which leaves the condition invalid,
  // so the rule never applies.
  private resolveEnvironment(text: string, bindings: IBindingScope): MaybePromise<string> {
    const parts: MaybePromise<string>[] = []
    let last = 0

    for (const match of text.matchAll(new RegExp(EXPRESSION_PATTERN, "g"))) {
      const whole = match[0]
      const binding = parseBindingExpression(match[1])

      parts.push(text.slice(last, match.index))
      parts.push(
        binding.type === "theme"
          ? thenMaybe(this.themes.getTheme(), (theme) => (theme ? this.resolveThemeText(whole, theme.groups) : whole))
          : thenMaybe(bindings.resolve(binding), (value) =>
              value === undefined || value === null ? whole : this.formatValue(value),
            ),
      )
      last = match.index + whole.length
    }

    parts.push(text.slice(last))

    return parts.some(isThenable)
      ? Promise.all(parts.map((part) => Promise.resolve(part))).then((resolved) => resolved.join(""))
      : (parts as string[]).join("")
  }

  private formatValue(value: unknown): string {
    return typeof value === "string" ? value : JSON.stringify(value)
  }

  // Aliases resolve through to their terminal value; an unknown token, or one
  // on an alias cycle, is left as written.
  private resolveThemeText(text: string, groups: IThemeGroup, seen: ReadonlySet<string> = new Set()): string {
    return text.replace(new RegExp(EXPRESSION_PATTERN, "g"), (whole: string, inner: string) => {
      const binding = parseBindingExpression(inner)

      if (binding.type !== "theme" || seen.has(binding.value)) {
        return whole
      }

      const node = resolveThemeNode(groups, binding.value)

      return typeof node === "string" ? this.resolveThemeText(node, groups, new Set([...seen, binding.value])) : whole
    })
  }

  private async resolveThemeToken(path: string): Promise<string | undefined> {
    const theme = await this.themes.getTheme()
    const node = theme ? resolveThemeNode(theme.groups, path) : undefined

    return typeof node === "string" ? node : undefined
  }

  // A qualifier's attach or a variable's subscription may settle after the
  // component was re-styled or removed; it then belongs to no record and is
  // dropped at once.
  private keep(component: Component, record: Applied, disposable: IDisposable): void {
    if (this.applied.get(component) === record) {
      record.disposers.push(() => disposable.dispose())
    } else {
      disposable.dispose()
    }
  }

  // Each push is numbered so a slow resolve (a dictionary loading) cannot
  // overwrite a newer value, and nothing writes once the record is gone.
  private bindVariable(
    component: Component,
    effect: IStyleEffect,
    variable: IStyleVariable,
    record: Applied,
    bindings: IBindingScope,
  ): MaybePromise<void> {
    const binding = parseBindingExpression(variable.source)
    let latest = 0

    const push = (): MaybePromise<void> => {
      const run = ++latest

      return thenMaybe(bindings.resolve(binding), (value) => {
        if (run === latest && this.applied.get(component) === record) {
          effect.setVariable(variable, value === undefined || value === null ? "" : this.formatValue(value))
        }
      })
    }

    record.variables.push({ effect, variable })

    return thenMaybe(
      thenMaybe(
        bindings.subscribe(binding, () => void push()),
        (unsubscribe) => this.keep(component, record, { dispose: unsubscribe }),
      ),
      push,
    )
  }

  private subscribe(names: readonly FQPropertyName[], handler: () => void): () => void {
    const wrapped: StateChangedHandler = () => handler()

    for (const name of names) {
      this.state.changed.on(name, wrapped)
    }

    return () => {
      for (const name of names) {
        this.state.changed.off(name, wrapped)
      }
    }
  }

  private acquire(key: string, build: () => StyleHandle): StyleHandle {
    const existing = this.cache.get(key)

    if (existing) {
      existing.refs++

      return existing.handle
    }

    const handle = build()

    this.cache.set(key, { handle, refs: 1 })

    return handle
  }

  private release(key: string): void {
    const existing = this.cache.get(key)

    if (!existing) {
      return
    }

    existing.refs--

    if (existing.refs === 0) {
      this.driver().release(existing.handle)
      this.cache.delete(key)
    }
  }

  private expandApplies(definition: IStyleDefinition, groups: IThemeGroup): IStyleDefinition {
    if (!definition.applies) {
      return definition
    }

    const rules: IStyleDefinition["rules"] = {}
    const signatures = new Set([...Object.keys(definition.rules), ...Object.keys(definition.applies)])

    for (const signature of signatures) {
      const declarations: Record<string, string> = {}

      for (const path of definition.applies[signature] ?? []) {
        const node = resolveThemeNode(groups, path)

        if (node && typeof node === "object") {
          for (const [name, value] of Object.entries(node)) {
            if (typeof value === "string") {
              declarations[name] = value
            }
          }
        }
      }

      Object.assign(declarations, definition.rules[signature])
      rules[signature] = declarations
    }

    const result: IStyleDefinition = { ...definition, rules }

    delete result.applies

    return result
  }

  // Every binding source in a value is delivered per instance, except an
  // unquoted theme token: the theme publishes those once, application-wide.
  // A source inside a quoted string is delivered as text.
  private declarationVariables(
    declarations: Readonly<Record<string, string>>,
    into = new Map<string, IStyleVariable>(),
  ): IStyleVariable[] {
    const add = (source: string, text: boolean): void => {
      if (text || parseBindingExpression(source).type !== "theme") {
        into.set(`${text ? "text" : "raw"} ${source}`, { source, text })
      }
    }

    for (const value of Object.values(declarations)) {
      for (const token of parseStyleValue(value)) {
        if (token.kind === "binding") {
          add(token.source, false)
        } else if (token.kind === "string") {
          for (const part of token.parts) {
            if (part.kind === "binding") {
              add(part.source, true)
            }
          }
        }
      }
    }

    return [...into.values()]
  }

  private keyframeVariables(definition: IStyleDefinition): IStyleVariable[] {
    const variables = new Map<string, IStyleVariable>()

    for (const frames of Object.values(definition.keyframes ?? {})) {
      for (const declarations of Object.values(frames)) {
        this.declarationVariables(declarations, variables)
      }
    }

    return [...variables.values()]
  }
}
