import { FrameworkElement } from "../FrameworkElement"
import { Component } from "./Component"
import { ComponentDefinitionProvider } from "./ComponentDefinitionProvider"
import { IDIContainer } from "../injection/IDIContainer"
import type { PlatformComponent } from "./PlatformComponent"
import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"
import type { IComponentDefinition, IComponentOverride, IComponentUsage } from "@heleonix/hx-language"
import {
  COMPONENT_NAME_SEGMENT_SEPARATOR,
  FQComponentName,
  FQPropertyName,
  getScopedPropertyName,
  joinFQComponentName,
  joinFQPropertyName,
} from "@heleonix/hx-language"
import { EventEmitter } from "../common/EventEmitter"
import type { IEventEmitter } from "../common/IEventEmitter"
import { IDIContainerInternal } from "../injection/IDIContainerInternal"
import { DimensionManager } from "../dimension/DimensionManager"
import { DictionaryProvider } from "../dictionaries/DictionaryProvider"
import { ConfigProvider } from "../configs/ConfigProvider"
import { StateManager } from "../state/StateManager"

const EMPTY_OVERRIDES: readonly IComponentOverride[] = Object.freeze([])

/** The swap override selected for a usage plus the remainders inherited by the built instance. */
interface OverrideResolution {
  swap: IComponentOverride | undefined
  inherited: IComponentOverride[]
}

export class ComponentManager extends FrameworkElement<
  ComponentDefinitionProvider | DimensionManager | DictionaryProvider | ConfigProvider | StateManager
> {
  private readonly componentDefinitionProvider = this.inject(ComponentDefinitionProvider)

  private readonly dimensionManager = this.inject(DimensionManager)

  private readonly dictionaryProvider = this.inject(DictionaryProvider)

  private readonly configProvider = this.inject(ConfigProvider)

  private readonly stateManager = this.inject(StateManager)

  private readonly diContainerInstance: IDIContainerInternal

  private anonymousComponentCounter = 0

  // Descent remainders (`sub.Button:Component`) pushed onto the instance that
  // starts the deeper scope; consulted when that instance renders its own
  // definition. Keyed weakly so entries drop when the component is collected.
  private readonly inheritedOverrides = new WeakMap<Component, readonly IComponentOverride[]>()

  private readonly componentBuiltEmitter = new EventEmitter<(fq: FQComponentName, instance: Component) => void>()

  private readonly componentDestroyedEmitter = new EventEmitter<(fq: FQComponentName) => void>()

  public constructor(diContainer: IDIContainer) {
    super(diContainer)

    this.diContainerInstance = diContainer as IDIContainerInternal
  }

  public static get diName(): string {
    return "ComponentManager"
  }

  public get componentBuilt(): IEventEmitter<(fq: FQComponentName, instance: Component) => void> {
    return this.componentBuiltEmitter
  }

  public get componentDestroyed(): IEventEmitter<(fq: FQComponentName) => void> {
    return this.componentDestroyedEmitter
  }

  public async buildComponent(
    usage: IComponentUsage,
    parent: Component | undefined,
    scopedParent: Component | undefined,
    platformParent: PlatformComponent | undefined,
  ): Promise<Component> {
    const fqComponentName = this.computeNewFQComponentName(usage, parent)

    const resolution = this.resolveScopeOverrides(usage, scopedParent)
    const definition = await this.resolveDefinition(usage, resolution.swap, scopedParent)

    if (!definition) {
      throw new HeleonixError(Errors.unknownComponent, usage.tag)
    }

    const instance = this.createComponent(definition)

    if (resolution.inherited.length > 0) {
      this.inheritedOverrides.set(instance, resolution.inherited)
    }

    await instance.build(fqComponentName, definition, usage, parent, scopedParent, platformParent)

    this.componentBuiltEmitter.emit(fqComponentName, instance)

    return instance
  }

  public destroyComponent(component: Component): void {
    this.inheritedOverrides.delete(component)

    component.destroy()

    this.componentDestroyedEmitter.emit(component.fqName)
  }

  public async reconcileChildren(
    host: Component,
    newUsages: IComponentUsage[] | undefined,
    buildParent: Component | undefined,
    scopedParent: Component | undefined,
    platformParent: PlatformComponent | undefined,
  ): Promise<void> {
    const oldByKey = new Map<string, Component>()

    for (const child of host.children) {
      const key = `${child.usage.tag}_${child.usage.name ?? ""}`

      oldByKey.set(key, child)
    }

    for (const newUsage of newUsages ?? []) {
      const key = `${newUsage.tag}_${newUsage.name ?? ""}`
      const existing = oldByKey.get(key)

      if (existing) {
        await this.updateComponent(existing, newUsage)
        oldByKey.delete(key)
      } else {
        const child = await this.buildComponent(newUsage, buildParent, scopedParent, platformParent)

        host.appendChild(child)

        child.mount()
      }
    }

    for (const removed of oldByKey.values()) {
      removed.unmount()
      host.removeChild(removed)

      this.destroyComponent(removed)
    }
  }

  public getTargetFQPropertyName(component: Component, propertyName: string): FQPropertyName {
    return joinFQPropertyName(component.fqName, propertyName)
  }

  public getSourceFQPropertyName(component: Component, bindingValue: string): FQPropertyName {
    const scopeFQ = component.scopedParent?.fqName

    return joinFQPropertyName(scopeFQ ?? "", bindingValue)
  }

  public getTargetScopedPropertyName(component: Component, fqPropertyName: FQPropertyName): string {
    return getScopedPropertyName(component.fqName, fqPropertyName)
  }

  private async updateComponent(component: Component, newUsage: IComponentUsage | undefined): Promise<void> {
    const effectiveUsage = newUsage ?? component.usage

    const resolution = this.resolveScopeOverrides(effectiveUsage, component.scopedParent)
    const newDefinition = await this.resolveDefinition(effectiveUsage, resolution.swap, component.scopedParent)

    if (!newDefinition) {
      throw new HeleonixError(Errors.unknownComponent, effectiveUsage.tag)
    }

    if (resolution.inherited.length > 0) {
      this.inheritedOverrides.set(component, resolution.inherited)
    } else {
      this.inheritedOverrides.delete(component)
    }

    await component.update(newDefinition, effectiveUsage)
  }

  /**
   * Matches `scopedParent`'s active overrides against `usage`: a single-segment
   * target selects the swap for this usage (a `name` match wins over a `tag`
   * match), while a multi-segment target whose first segment names this usage
   * contributes its remainder to the instance's inherited overrides.
   */
  private resolveScopeOverrides(usage: IComponentUsage, scopedParent: Component | undefined): OverrideResolution {
    const active = this.activeOverridesOf(scopedParent)

    if (active.length === 0) {
      return { swap: undefined, inherited: [] }
    }

    let nameLeaf: IComponentOverride | undefined
    let tagLeaf: IComponentOverride | undefined
    const inherited: IComponentOverride[] = []

    for (const override of active) {
      const segments = override.target.split(COMPONENT_NAME_SEGMENT_SEPARATOR)
      const first = segments[0]

      if (segments.length === 1) {
        if (usage.name !== undefined && first === usage.name) {
          nameLeaf = override
        } else if (first === usage.tag) {
          tagLeaf = override
        }
      } else if (usage.name !== undefined && first === usage.name) {
        inherited.push({ ...override, target: segments.slice(1).join(COMPONENT_NAME_SEGMENT_SEPARATOR) })
      }
    }

    return { swap: nameLeaf ?? tagLeaf, inherited }
  }

  private activeOverridesOf(scopedParent: Component | undefined): readonly IComponentOverride[] {
    if (!scopedParent) {
      return EMPTY_OVERRIDES
    }

    const own = scopedParent.usage.overrides ?? EMPTY_OVERRIDES
    const inherited = this.inheritedOverrides.get(scopedParent) ?? EMPTY_OVERRIDES

    if (own.length === 0) {
      return inherited
    }

    if (inherited.length === 0) {
      return own
    }

    return [...own, ...inherited]
  }

  /**
   * The definition to build `usage` with. Without a swap this is the usual
   * lookup by tag; a swap replaces it with the inline children, the component
   * named by the swap's binding (bare name, or a dictionary/config entry value),
   * or an empty definition that renders nothing.
   */
  private async resolveDefinition(
    usage: IComponentUsage,
    swap: IComponentOverride | undefined,
    scopedParent: Component | undefined,
  ): Promise<IComponentDefinition | undefined> {
    if (!swap) {
      return this.componentDefinitionProvider.getDefinition(usage.tag)
    }

    const dimension = this.dimensionManager.currentDimension

    if (swap.children) {
      return { tag: usage.tag, dimension, children: swap.children }
    }

    if (swap.binding) {
      const name = await this.resolveOverrideName(swap, scopedParent)
      const definition = name ? await this.componentDefinitionProvider.getDefinition(name) : undefined

      if (!definition) {
        throw new HeleonixError(Errors.invalidOverrideComponent, name ?? "", swap.target)
      }

      return definition
    }

    return { tag: usage.tag, dimension }
  }

  private async resolveOverrideName(
    override: IComponentOverride,
    scopedParent: Component | undefined,
  ): Promise<string | undefined> {
    const binding = override.binding!

    switch (binding.type) {
      case "state":
        return binding.value
      case "config": {
        const value = await this.configProvider.getValue(binding.value)

        return typeof value === "string" ? value : undefined
      }
      case "dictionary": {
        const scopeFQ = scopedParent?.fqName ?? ""

        return this.dictionaryProvider.getValue(binding.value, (param) =>
          this.stateManager.getValue(joinFQPropertyName(scopeFQ, param)),
        )
      }
    }
  }

  private createComponent(definition: IComponentDefinition): Component {
    const typeName = definition.type ?? "DeclarativeComponent"

    try {
      return this.diContainerInstance.inject<Component>(typeName)
    } catch {
      throw new HeleonixError(Errors.componentCreation, typeName)
    }
  }

  private computeNewFQComponentName(usage: IComponentUsage, parent: Component | undefined): FQComponentName {
    const name = usage.name ?? `${this.anonymousComponentCounter++}`

    return joinFQComponentName(parent?.fqName, name)
  }
}
