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
import type { IStyleDriver } from "../platform/IStyleDriver"
import type { IStyleEffect } from "../platform/IStyleEffect"
import type { IStyleVariable } from "../platform/IStyleVariable"
import type { QualifierProvider } from "./qualifiers/QualifierProvider"
import { StyleDefinitionLoader } from "./StyleDefinitionLoader"
import type { StyleCondition } from "./StyleCondition"
import { hashStyleKey } from "./hashStyleKey"
import { styleVariableName } from "./styleVariableName"
import type { ThemeManager } from "../theming/ThemeManager"
import type { IClearable } from "../common/IClearable"
import type { IDisposable } from "../common/IDisposable"
import type { MaybePromise } from "../common/MaybePromise"
import { isThenable } from "../common/isThenable"
import { thenMaybe } from "../common/thenMaybe"

const SCOPE_QUALIFIER = "Style"

const SCOPE_PATH_SEPARATOR = "."

const ANIMATION_PROPERTIES = new Set(["animation", "animation-name"])

interface AppliedRule {
  id: string | undefined
  effects: readonly IStyleEffect[]
}

interface VariableSource {
  source: string
  text: boolean
}

interface Applied {
  // Whether the style has a `@hx-style(for: ...)` rule, so a newly built
  // descendant can trigger the component to re-resolve its scope and pick it up.
  scoped: boolean
  keyframes: string[]
  rules: AppliedRule[]
  variables: { effect: IStyleEffect; variable: IStyleVariable }[]
  disposers: (() => void)[]
}

export class StyleManager implements IClearable {
  private readonly refs = new Map<string, number>()

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
    private readonly qualifiers: QualifierProvider,
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

    const record: Applied = { scoped: false, keyframes: [], rules: [], variables: [], disposers: [] }

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

    const keyframes = this.keyframeIdsOf(definition)
    const driver = this.driver()

    if (driver.insertKeyframes) {
      for (const [name, frames] of Object.entries(definition.keyframes ?? {})) {
        const id = keyframes.get(name)!

        this.acquire(id, () => driver.insertKeyframes!(id, frames))
        record.keyframes.push(id)
      }
    }

    for (const [signature, written] of Object.entries(definition.rules)) {
      const usages = parseRuleKey(signature)
      const scopeUsage = usages.find((usage) => usage.name === SCOPE_QUALIFIER)
      const qualified = scopeUsage ? usages.filter((usage) => usage !== scopeUsage) : usages
      const targets = scopeUsage ? this.resolveScope(component, scopeUsage.args["for"]) : [component]

      record.scoped ||= scopeUsage !== undefined

      if (targets.length === 0) {
        continue
      }

      const conditions = qualified.flatMap((usage) => this.qualifiers.get(usage.name)?.build?.(usage) ?? [])
      const declarations = this.scopeAnimations(written, keyframes)
      const variables = this.declarationVariables(declarations)
      const targetEffects = targets.map(effectFor)

      settle(this.applyRule(component, record, bindings, { declarations, conditions }, targetEffects))

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
    this.refs.clear()
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
      if (rule.id) {
        for (const effect of rule.effects) {
          effect.removeClass(rule.id)
        }

        this.release(rule.id)
      }
    }

    for (const id of record.keyframes) {
      this.release(id)
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
  // environment are resolved into it, and the rule recomposes - under the id of
  // its resolved input - whenever a property it reads changes; a dimension
  // switch re-applies the whole style. A rule without sources composes at once.
  private applyRule(
    component: Component,
    record: Applied,
    bindings: IBindingScope,
    rule: { declarations: Readonly<Record<string, string>>; conditions: readonly StyleCondition[] },
    effects: readonly IStyleEffect[],
  ): MaybePromise<void> {
    const entry: AppliedRule = { id: undefined, effects }
    let latest = 0

    record.rules.push(entry)

    const recompose = (): MaybePromise<void> => {
      const run = ++latest

      return thenMaybe(this.resolveConditions(rule.conditions, bindings), (conditions) => {
        if (run !== latest || this.applied.get(component) !== record) {
          return
        }

        // The id is derived from the whole compose input, so only identical
        // rules share one inserted rule, and a resolved environment is part of
        // it; the signature is not, since it reaches the rule through both.
        const id = `hx-${hashStyleKey(`${JSON.stringify(conditions)} ${JSON.stringify(rule.declarations)}`)}`

        if (id === entry.id) {
          return
        }

        this.acquire(id, () => this.driver().insertRule({ id, conditions, declarations: rule.declarations }))

        for (const effect of effects) {
          effect.addClass(id)

          if (entry.id) {
            effect.removeClass(entry.id)
          }
        }

        if (entry.id) {
          this.release(entry.id)
        }

        entry.id = id
      })
    }

    const subscribing = this.environmentSources(rule.conditions)
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

  private environmentSources(conditions: readonly StyleCondition[]): IBindingExpression[] {
    return conditions.flatMap((condition) =>
      "environment" in condition ? extractParameters(condition.environment).map(parseBindingExpression) : [],
    )
  }

  private resolveConditions(
    conditions: readonly StyleCondition[],
    bindings: IBindingScope,
  ): MaybePromise<readonly StyleCondition[]> {
    if (this.environmentSources(conditions).length === 0) {
      return conditions
    }

    const resolved = conditions.map((condition) =>
      "environment" in condition
        ? thenMaybe(this.resolveEnvironment(condition.environment, bindings), (environment) => ({ environment }))
        : condition,
    )

    return resolved.some(isThenable)
      ? Promise.all(resolved.map((condition) => Promise.resolve(condition)))
      : (resolved as StyleCondition[])
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
    { source, text }: VariableSource,
    record: Applied,
    bindings: IBindingScope,
  ): MaybePromise<void> {
    const binding = parseBindingExpression(source)
    const variable: IStyleVariable = { name: styleVariableName(source, text), text }
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

  private acquire(id: string, insert: () => void): void {
    const refs = this.refs.get(id) ?? 0

    if (refs === 0) {
      insert()
    }

    this.refs.set(id, refs + 1)
  }

  private release(id: string): void {
    const refs = this.refs.get(id)

    if (refs === undefined) {
      return
    }

    if (refs === 1) {
      this.refs.delete(id)
      this.driver().remove(id)
    } else {
      this.refs.set(id, refs - 1)
    }
  }

  // A local timeline is named by its style and its frames, so components cannot
  // clash over a name, and an overlay that retunes the frames gets a timeline of
  // its own instead of the one its siblings still play.
  private keyframeIdsOf(definition: IStyleDefinition): ReadonlyMap<string, string> {
    return new Map(
      Object.entries(definition.keyframes ?? {}).map(([name, frames]) => [
        name,
        `hx-${definition.name}-${name}-${hashStyleKey(JSON.stringify(frames))}`,
      ]),
    )
  }

  // An animation reference resolves against the style's own timelines first;
  // any other name is left to the theme's shared ones.
  private scopeAnimations(
    declarations: Readonly<Record<string, string>>,
    keyframes: ReadonlyMap<string, string>,
  ): Readonly<Record<string, string>> {
    if (keyframes.size === 0) {
      return declarations
    }

    const scoped: Record<string, string> = {}

    for (const [property, value] of Object.entries(declarations)) {
      scoped[property] = ANIMATION_PROPERTIES.has(property)
        ? value.replace(/[^\s,]+/g, (token) => keyframes.get(token) ?? token)
        : value
    }

    return scoped
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
    into = new Map<string, VariableSource>(),
  ): VariableSource[] {
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

  private keyframeVariables(definition: IStyleDefinition): VariableSource[] {
    const variables = new Map<string, VariableSource>()

    for (const frames of Object.values(definition.keyframes ?? {})) {
      for (const declarations of Object.values(frames)) {
        this.declarationVariables(declarations, variables)
      }
    }

    return [...variables.values()]
  }
}
