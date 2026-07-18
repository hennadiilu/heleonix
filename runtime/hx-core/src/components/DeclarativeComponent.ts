import { Component } from "./Component"
import type {
  IComponentDefinition,
  IComponentProperty,
  IComponentUsage,
} from "@heleonix/hx-language"
import { ComponentManager } from "./ComponentManager"
import type { PlatformComponent } from "./PlatformComponent"
import { StateManager } from "../state/StateManager"
import { DictionaryManager } from "../dictionaries/DictionaryManager"
import { ConfigManager } from "../configs/ConfigManager"

export class DeclarativeComponent extends Component {
  protected readonly dictionaryManager = this.inject(DictionaryManager)

  protected readonly configManager = this.inject(ConfigManager)

  protected readonly stateManager = this.inject(StateManager)

  protected readonly componentManager = this.inject(ComponentManager)

  public static get diName(): string {
    return "DeclarativeComponent"
  }

  public override async build(
    fqName: string,
    definition: IComponentDefinition,
    usage: IComponentUsage,
    parent: Component | undefined,
    scopedParent: Component | undefined,
    platformParent: PlatformComponent | undefined,
  ): Promise<void> {
    await super.build(fqName, definition, usage, parent, scopedParent, platformParent)

    this.scopedParent = this

    await this.applyBindings(usage.properties)

    if (definition.children) {
      for (const childUsage of definition.children) {
        const component = await this.componentManager.buildComponent(childUsage, this, this, platformParent)

        this.appendChild(component)

        component.mount()
      }
    }
  }

  public override async update(newDefinition: IComponentDefinition, newUsage: IComponentUsage): Promise<void> {
    await this.diffAndApplyBindings(this.usage.properties, newUsage.properties)

    await this.componentManager.reconcileChildren(this, newDefinition.children, this, this, this.platformParent)

    await super.update(newDefinition, newUsage)
  }

  public override destroy(): void {
    this.removeBindings(this.usage.properties)

    for (const child of [...this.children]) {
      child.unmount()
      this.removeChild(child)

      this.componentManager.destroyComponent(child)
    }

    super.destroy()
  }

  private async diffAndApplyBindings(
    oldProps: IComponentProperty[] | undefined,
    newProps: IComponentProperty[] | undefined,
  ): Promise<void> {
    const oldMap = new Map<string, IComponentProperty>()

    for (const p of oldProps ?? []) {
      oldMap.set(p.name, p)
    }

    const newMap = new Map<string, IComponentProperty>()

    for (const p of newProps ?? []) {
      newMap.set(p.name, p)
    }

    for (const [name] of oldMap) {
      if (!newMap.has(name)) {
        this.removeBinding(oldMap.get(name)!)
      }
    }

    for (const [name, newProp] of newMap) {
      const oldProp = oldMap.get(name)

      if (!oldProp) {
        await this.applyBinding(newProp)
      } else if (this.hasBindingChanged(oldProp, newProp)) {
        this.removeBinding(oldProp)
        await this.applyBinding(newProp)
      }
    }
  }

  private hasBindingChanged(oldProp: IComponentProperty, newProp: IComponentProperty): boolean {
    return oldProp.binding.type !== newProp.binding.type || oldProp.binding.value !== newProp.binding.value
  }

  private async applyBindings(properties: IComponentProperty[] | undefined): Promise<void> {
    if (!properties) {
      return
    }

    for (const property of properties) {
      await this.applyBinding(property)
    }
  }

  private async applyBinding(property: IComponentProperty): Promise<void> {
    const targetFQPropertyName = this.componentManager.getTargetFQPropertyName(this, property.name)

    switch (property.binding.type) {
      case "state":
        this.stateManager.bind(
          targetFQPropertyName,
          this.componentManager.getSourceFQPropertyName(this, property.binding.value),
        )
        break
      case "dictionary":
        await this.dictionaryManager.bind(targetFQPropertyName, property.binding.value, this.fqName)
        break
      case "config":
        await this.configManager.bind(targetFQPropertyName, property.binding.value)
        break
    }
  }

  private removeBindings(properties: IComponentProperty[] | undefined): void {
    if (!properties) {
      return
    }

    for (const property of properties) {
      this.removeBinding(property)
    }
  }

  private removeBinding(property: IComponentProperty): void {
    const targetFQPropertyName = this.componentManager.getTargetFQPropertyName(this, property.name)

    switch (property.binding.type) {
      case "state":
        this.stateManager.unbind(
          targetFQPropertyName,
          this.componentManager.getSourceFQPropertyName(this, property.binding.value),
        )
        break
      case "dictionary":
        this.dictionaryManager.unbind(targetFQPropertyName)
        break
      case "config":
        this.configManager.unbind(targetFQPropertyName)
        break
    }
  }
}
