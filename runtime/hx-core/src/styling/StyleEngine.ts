import { parseRuleKey } from "@heleonix/hx-language"
import type { IQualifierUsage, IStyleDefinition } from "@heleonix/hx-language"
import { declarationStateProps } from "./declarationStateProps"
import type { ComponentStateAccessor } from "./ComponentStateAccessor"
import type { IKeyframeScope } from "./IKeyframeScope"
import type { QualifierRegistry } from "./QualifierRegistry"
import type { StyleEffect } from "./StyleEffect"
import type { StyleEnginePlatform } from "./StyleEnginePlatform"
import type { StyleEngineState } from "./StyleEngineState"
import type { StyleFragment } from "./StyleFragment"
import type { StyleHandle } from "./StyleHandle"
import type { StyleScopeResolver } from "./StyleScopeResolver"

const SCOPE_QUALIFIER = "Style"

interface Applied {
  keyframeKeys: string[]
  ruleKeys: string[]
  classes: { effect: StyleEffect; handle: StyleHandle }[]
  variables: { effect: StyleEffect; prop: string }[]
  disposers: (() => void)[]
}

/**
 * Platform-neutral styling lifecycle: applies a compiled style to a component
 * and removes it, sharing one composed artifact per signature across instances
 * (build-once + refcount, released when the last holder drops it) and keeping
 * `{prop}` declarations reactive by pushing their values through the effect. A
 * plain rule lands on the component's own root; a `@hx-style(for: ...)` rule is
 * redirected (via the {@link StyleScopeResolver}) onto its matched descendants -
 * its class, its qualifier `attach`es, and its `{prop}` variables all target
 * them. Re-applying is idempotent (it removes first), which is how a dimension
 * change re-styles. DI-free by design; the DI `StyleManager` supplies the real
 * platform, state and scope resolver.
 */
export class StyleEngine<TComponent> {
  private readonly cache = new Map<string, { handle: StyleHandle; refs: number }>()

  private readonly applied = new Map<TComponent, Applied>()

  public constructor(
    private readonly registry: QualifierRegistry,
    private readonly platform: StyleEnginePlatform<TComponent>,
    private readonly state: StyleEngineState<TComponent>,
    private readonly scope?: StyleScopeResolver<TComponent>,
  ) {}

  public apply(component: TComponent, definition: IStyleDefinition): void {
    this.remove(component)

    const ownEffect = this.platform.effectFor(component)
    const effects = new Map<TComponent, StyleEffect>([[component, ownEffect]])
    const effectFor = (target: TComponent): StyleEffect => {
      let effect = effects.get(target)

      if (!effect) {
        effect = this.platform.effectFor(target)
        effects.set(target, effect)
      }

      return effect
    }

    const stateAccessor: ComponentStateAccessor = {
      subscribe: (prop, handler) => this.state.subscribe(component, prop, handler),
      getValue: (prop) => this.state.getValue(component, prop),
    }

    const record: Applied = { keyframeKeys: [], ruleKeys: [], classes: [], variables: [], disposers: [] }

    const keyframeScope: IKeyframeScope | undefined = definition.keyframes
      ? { scope: definition.name, names: Object.keys(definition.keyframes) }
      : undefined

    if (definition.keyframes && this.platform.composeKeyframe) {
      for (const [name, frames] of Object.entries(definition.keyframes)) {
        const key = `@keyframes ${definition.name} ${name} ${JSON.stringify(frames)}`

        this.acquire(key, () => this.platform.composeKeyframe!(definition.name, name, frames))
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
      const handle = this.acquire(key, () => this.platform.compose(signature, fragments, declarations, keyframeScope))

      record.ruleKeys.push(key)

      const props = declarationStateProps(declarations)

      for (const target of targets) {
        const effect = effectFor(target)

        effect.setClass(handle)
        record.classes.push({ effect, handle })

        for (const usage of usages) {
          if (usage.name === SCOPE_QUALIFIER) {
            continue
          }

          const disposable = this.registry.get(usage.name)?.attach?.(usage, stateAccessor, effect)

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

  public remove(component: TComponent): void {
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

  private resolveTargets(component: TComponent, usages: readonly IQualifierUsage[]): TComponent[] | undefined {
    const scopeUsage = usages.find((usage) => usage.name === SCOPE_QUALIFIER)

    if (!scopeUsage) {
      return [component]
    }

    const path = scopeUsage.args["for"]

    if (!this.scope || !path) {
      return undefined
    }

    const resolved = this.scope.resolve(component, path)

    return resolved.length > 0 ? [...resolved] : undefined
  }

  private buildFragments(usages: readonly IQualifierUsage[]): StyleFragment[] {
    const fragments: StyleFragment[] = []

    for (const usage of usages) {
      if (usage.name === SCOPE_QUALIFIER) {
        continue
      }

      const fragment = this.registry.get(usage.name)?.build?.(usage)

      if (fragment) {
        fragments.push(fragment)
      }
    }

    return fragments
  }

  private bindVariable(component: TComponent, effect: StyleEffect, prop: string, record: Applied): void {
    const push = (): void => effect.setVariable(prop, String(this.state.getValue(component, prop)))

    record.disposers.push(this.state.subscribe(component, prop, push))
    push()
    record.variables.push({ effect, prop })
  }

  private keyframeProps(definition: IStyleDefinition): string[] {
    const props = new Set<string>()

    for (const frames of Object.values(definition.keyframes ?? {})) {
      for (const declarations of Object.values(frames)) {
        for (const prop of declarationStateProps(declarations)) {
          props.add(prop)
        }
      }
    }

    return [...props]
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
      this.platform.release(existing.handle)
      this.cache.delete(key)
    }
  }
}
