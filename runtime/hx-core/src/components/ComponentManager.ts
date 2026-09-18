import { Component } from "./Component"
import { ComponentDefinitionLoader } from "./ComponentDefinitionLoader"
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
import type { ComponentConstructor } from "./ComponentConstructor"
import type { StyleManager } from "../styling/StyleManager"
import type { IComponentContext } from "./IComponentContext"
import type { IDimensionProvider } from "../dimension/IDimensionProvider"
import type { IDictionaryProvider } from "../dictionaries/IDictionaryProvider"
import type { IConfigProvider } from "../configs/IConfigProvider"
import type { IComponentManager } from "./IComponentManager"
import type { IClearable } from "../common/IClearable"

const EMPTY_OVERRIDES: readonly IComponentOverride[] = Object.freeze([])

interface OverrideResolution {
  swap: IComponentOverride | undefined
  inherited: IComponentOverride[]
}

export class ComponentManager implements IComponentManager, IClearable {
  private anonymousComponentCounter = 0

  // Descent remainders (`sub.Button:Component`) pushed onto the instance that
  // starts the deeper scope; consulted when that instance renders its own
  // definition. Keyed weakly so entries drop when the component is collected.
  private readonly inheritedOverrides = new WeakMap<Component, readonly IComponentOverride[]>()

  public constructor(
    // Absent when the application bootstraps no component definitions: it has no
    // components at all, so every tag resolves to nothing.
    private readonly loader: ComponentDefinitionLoader | undefined,
    private readonly dimensions: IDimensionProvider,
    private readonly dictionaries: IDictionaryProvider,
    private readonly configs: IConfigProvider,
    private readonly componentCtors: ReadonlyMap<string, ComponentConstructor>,
    // A thunk: the context holds this manager as its `components`, so it is
    // created after the manager. Resolved lazily when a component is first built.
    private readonly context: () => IComponentContext,
    // Absent when the application bootstraps no style definitions.
    private readonly styles: StyleManager | undefined,
  ) {}

  public clear(): void {
    this.anonymousComponentCounter = 0
  }

  public async build(
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

    await this.styles?.apply(instance)

    instance.mount()

    return instance
  }

  public async update(component: Component, newUsage: IComponentUsage): Promise<void> {
    const resolution = this.resolveScopeOverrides(newUsage, component.scopedParent)
    const newDefinition = await this.resolveDefinition(newUsage, resolution.swap, component.scopedParent)

    if (!newDefinition) {
      throw new HeleonixError(Errors.unknownComponent, newUsage.tag)
    }

    if (resolution.inherited.length > 0) {
      this.inheritedOverrides.set(component, resolution.inherited)
    } else {
      this.inheritedOverrides.delete(component)
    }

    await component.update(newDefinition, newUsage)
  }

  public destroy(component: Component): void {
    component.unmount()

    this.styles?.remove(component)

    this.inheritedOverrides.delete(component)

    component.destroy()
  }

  public getTargetFQPropertyName(component: Component, propertyName: string): FQPropertyName {
    return joinFQPropertyName(component.fqName, propertyName)
  }

  public getTargetScopedPropertyName(component: Component, fqPropertyName: FQPropertyName): string {
    return getScopedPropertyName(component.fqName, fqPropertyName)
  }

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

  private async resolveDefinition(
    usage: IComponentUsage,
    swap: IComponentOverride | undefined,
    scopedParent: Component | undefined,
  ): Promise<IComponentDefinition | undefined> {
    if (!swap) {
      return this.loader?.loadDefinition(usage.tag)
    }

    const dimension = this.dimensions.current

    if (swap.children) {
      return { tag: usage.tag, dimension, children: swap.children }
    }

    if (swap.binding) {
      const name = await this.resolveOverrideName(swap, scopedParent)
      const definition = name ? await this.loader?.loadDefinition(name) : undefined

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
        const value = await this.configs.get(binding.value)

        return typeof value === "string" ? value : undefined
      }
      case "dictionary":
        return this.dictionaries.get(binding.value, scopedParent?.fqName ?? "")
      case "literal": {
        // Quoted static text names the replacement component directly.
        const value: unknown = JSON.parse(binding.value)

        return typeof value === "string" ? value : undefined
      }
    }
  }

  private createComponent(definition: IComponentDefinition): Component {
    const typeName = definition.type ?? "DeclarativeComponent"

    const ctor = this.componentCtors.get(typeName)

    if (!ctor) {
      throw new HeleonixError(Errors.componentCreation, typeName)
    }

    return new ctor(this.context())
  }

  private computeNewFQComponentName(usage: IComponentUsage, parent: Component | undefined): FQComponentName {
    const name = usage.name ?? `${this.anonymousComponentCounter++}`

    return joinFQComponentName(parent?.fqName, name)
  }
}
