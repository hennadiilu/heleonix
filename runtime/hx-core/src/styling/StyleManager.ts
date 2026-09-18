import {
  extractParameters,
  joinFQPropertyName,
  parseBindingExpression,
  parseRuleKey,
  resolveThemeNode,
} from "@heleonix/hx-language"
import type { FQPropertyName, IQualifierUsage, IStyleDefinition, IThemeGroup } from "@heleonix/hx-language"
import { Component } from "../components/Component"
import { componentScopeResolver } from "./ComponentScopeResolver"
import type { IState } from "../state/IState"
import type { StateChangedHandler } from "../state/StateChangedHandler"
import type { IComponentState } from "./qualifiers/IComponentState"
import type { IKeyframeScope } from "../platform/IKeyframeScope"
import type { IStyleDriver } from "../platform/IStyleDriver"
import type { IStyleEffect } from "../platform/IStyleEffect"
import type { IStyleScopeResolver } from "./IStyleScopeResolver"
import type { IQualifierProvider } from "./qualifiers/IQualifierProvider"
import { StyleDefinitionLoader } from "./StyleDefinitionLoader"
import type { StyleFragment } from "./StyleFragment"
import type { StyleHandle } from "../platform/StyleHandle"
import { ThemeManager } from "../theming/ThemeManager"
import type { IClearable } from "../common/IClearable"

const SCOPE_QUALIFIER = "Style"

interface Applied {
  keyframeKeys: string[]
  ruleKeys: string[]
  classes: { effect: IStyleEffect; handle: StyleHandle }[]
  variables: { effect: IStyleEffect; prop: string }[]
  disposers: (() => void)[]
}

export class StyleManager implements IClearable {
  private readonly cache = new Map<string, { handle: StyleHandle; refs: number }>()

  private readonly applied = new Map<Component, Applied>()

  private readonly styled = new Set<Component>()

  // Styled components whose style has a `@hx-style(for: ...)` rule, so a newly
  // built descendant can trigger them to re-resolve their scope and pick it up.
  private readonly scopedStyled = new Set<Component>()

  public constructor(
    // A thunk, not the driver itself: a runtime rebuilds its style driver on
    // every start (the web discards its sheet on stop), so the driver must be
    // resolved per use rather than captured once at composition time.
    private readonly driver: () => IStyleDriver,
    private readonly loader: StyleDefinitionLoader,
    private readonly themes: ThemeManager,
    private readonly state: IState,
    private readonly qualifiers: IQualifierProvider,
    private readonly scopeResolver: IStyleScopeResolver = componentScopeResolver,
  ) {}

  public async apply(component: Component): Promise<void> {
    await this.applyOwn(component)

    for (let ancestor = component.parent; ancestor; ancestor = ancestor.parent) {
      if (this.scopedStyled.has(ancestor)) {
        await this.applyOwn(ancestor)
      }
    }
  }

  public applyDefinition(component: Component, definition: IStyleDefinition): void {
    this.removeApplied(component)

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

    const componentState: IComponentState = {
      subscribe: (prop, handler) => this.subscribeToProp(component, prop, handler),
      getValue: (prop) => this.getPropValue(component, prop),
    }

    const record: Applied = { keyframeKeys: [], ruleKeys: [], classes: [], variables: [], disposers: [] }

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
      const targets = this.resolveTargets(component, usages)

      if (!targets) {
        continue
      }

      const fragments = this.buildFragments(usages)

      // The share key is the compose input, not the signature alone: only
      // byte-identical rules share one composed artifact. A style with local
      // keyframes also scope-qualifies the key, since its rules resolve
      // animation references against its own keyframes.
      const key = `${keyframeScope ? definition.name : ""} ${signature} ${JSON.stringify(declarations)}`
      const handle = this.acquire(key, () => this.driver().compose(signature, fragments, declarations, keyframeScope))

      record.ruleKeys.push(key)

      const props = this.declarationStateProps(declarations)

      for (const target of targets) {
        const effect = effectFor(target)

        effect.setClass(handle)
        record.classes.push({ effect, handle })

        for (const usage of usages) {
          if (usage.name === SCOPE_QUALIFIER) {
            continue
          }

          const disposable = this.qualifiers.get(usage.name)?.attach?.(usage, componentState, effect)

          if (disposable) {
            record.disposers.push(() => disposable.dispose())
          }
        }

        for (const prop of props) {
          this.bindVariable(component, effect, prop, record)
        }
      }
    }

    for (const prop of this.keyframeProps(definition)) {
      this.bindVariable(component, ownEffect, prop, record)
    }

    this.applied.set(component, record)
  }

  public clear(): void {
    for (const component of [...this.applied.keys()]) {
      this.removeApplied(component)
    }

    this.styled.clear()
    this.scopedStyled.clear()
    this.cache.clear()
  }

  public remove(component: Component): void {
    this.styled.delete(component)
    this.scopedStyled.delete(component)

    this.removeApplied(component)
  }

  public async reapply(): Promise<void> {
    for (const component of [...this.styled]) {
      await this.applyOwn(component)
    }
  }

  private async applyOwn(component: Component): Promise<void> {
    const definition = await this.resolveDefinition(component.definition.tag)

    if (definition) {
      this.applyDefinition(component, definition)
      this.styled.add(component)

      if (hasScopeRule(definition)) {
        this.scopedStyled.add(component)
      } else {
        this.scopedStyled.delete(component)
      }
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

    for (const { effect, handle } of record.classes) {
      effect.removeClass(handle)
    }

    for (const key of record.ruleKeys) {
      this.release(key)
    }

    for (const key of record.keyframeKeys) {
      this.release(key)
    }

    for (const { effect, prop } of record.variables) {
      effect.removeVariable(prop)
    }

    this.applied.delete(component)
  }

  private resolveTargets(component: Component, usages: readonly IQualifierUsage[]): Component[] | undefined {
    const scopeUsage = usages.find((usage) => usage.name === SCOPE_QUALIFIER)

    if (!scopeUsage) {
      return [component]
    }

    const path = scopeUsage.args["for"]

    if (!path) {
      return undefined
    }

    const resolved = this.scopeResolver.resolve(component, path)

    return resolved.length > 0 ? [...resolved] : undefined
  }

  private buildFragments(usages: readonly IQualifierUsage[]): StyleFragment[] {
    const fragments: StyleFragment[] = []

    for (const usage of usages) {
      if (usage.name === SCOPE_QUALIFIER) {
        continue
      }

      const fragment = this.qualifiers.get(usage.name)?.build?.(usage)

      if (fragment) {
        fragments.push(fragment)
      }
    }

    return fragments
  }

  private bindVariable(component: Component, effect: IStyleEffect, prop: string, record: Applied): void {
    const push = (): void => effect.setVariable(prop, String(this.getPropValue(component, prop)))

    record.disposers.push(this.subscribeToProp(component, prop, push))
    push()
    record.variables.push({ effect, prop })
  }

  private subscribeToProp(component: Component, prop: string, handler: () => void): () => void {
    const name = fqPropertyOf(component, prop)
    const wrapped: StateChangedHandler = () => handler()

    this.state.changed.on(name, wrapped)

    return () => this.state.changed.off(name, wrapped)
  }

  private getPropValue(component: Component, prop: string): unknown {
    return this.state.getValue(fqPropertyOf(component, prop))
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

  private declarationStateProps(declarations: Readonly<Record<string, string>>): string[] {
    const props = new Set<string>()

    for (const value of Object.values(declarations)) {
      for (const inner of extractParameters(value)) {
        const binding = parseBindingExpression(inner)

        if (binding.type === "state" && binding.value) {
          props.add(binding.value)
        }
      }
    }

    return [...props]
  }

  private keyframeProps(definition: IStyleDefinition): string[] {
    const props = new Set<string>()

    for (const frames of Object.values(definition.keyframes ?? {})) {
      for (const declarations of Object.values(frames)) {
        for (const prop of this.declarationStateProps(declarations)) {
          props.add(prop)
        }
      }
    }

    return [...props]
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
}

function fqPropertyOf(component: Component, prop: string): FQPropertyName {
  return joinFQPropertyName(component.fqName, prop)
}

function hasScopeRule(definition: IStyleDefinition): boolean {
  return Object.keys(definition.rules).some((signature) =>
    parseRuleKey(signature).some((usage) => usage.name === SCOPE_QUALIFIER),
  )
}
