import { Component } from "./Component"
import type {
  IComponentDefinition,
  IComponentProperty,
  IComponentUsage,
} from "@heleonix/hx-language"
import { ComponentManager } from "./ComponentManager"
import { StateManager } from "../state/StateManager"
import { StateChangedHandler } from "../state/StateChangedHandler"
import { DictionaryManager } from "../dictionaries/DictionaryManager"
import { ConfigManager } from "../configs/ConfigManager"
import type { PlatformComponent } from "./PlatformComponent"

const VALUE_PROPERTY = "value"

export class Content extends Component {
  protected readonly dictionaryManager = this.inject(DictionaryManager)

  protected readonly configManager = this.inject(ConfigManager)

  protected readonly stateManager = this.inject(StateManager)

  protected readonly componentManager = this.inject(ComponentManager)

  private currentBinding: IComponentProperty | undefined

  public static get diName(): string {
    return "Content"
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

    const property = this.findValueProperty(usage.properties)

    if (property) {
      this.currentBinding = property

      await this.applyBinding(property)
    }
  }

  public override async update(newDefinition: IComponentDefinition, newUsage: IComponentUsage): Promise<void> {
    const oldProp = this.currentBinding
    const newProp = this.findValueProperty(newUsage.properties)

    if (!oldProp && newProp) {
      this.currentBinding = newProp

      await this.applyBinding(newProp)
    } else if (oldProp && !newProp) {
      this.removeBinding(oldProp)

      this.currentBinding = undefined
    } else if (oldProp && newProp && this.hasBindingChanged(oldProp, newProp)) {
      this.removeBinding(oldProp)

      this.currentBinding = newProp

      await this.applyBinding(newProp)
    }

    await super.update(newDefinition, newUsage)
  }

  public override destroy(): void {
    if (this.currentBinding) {
      this.removeBinding(this.currentBinding)

      this.currentBinding = undefined
    }

    super.destroy()
  }

  private findValueProperty(properties: IComponentProperty[] | undefined): IComponentProperty | undefined {
    if (!properties) {
      return undefined
    }

    for (const property of properties) {
      if (property.name === VALUE_PROPERTY) {
        return property
      }
    }

    return undefined
  }

  private hasBindingChanged(oldProp: IComponentProperty, newProp: IComponentProperty): boolean {
    return oldProp.binding.type !== newProp.binding.type || oldProp.binding.value !== newProp.binding.value
  }

  private async applyBinding(property: IComponentProperty): Promise<void> {
    const targetFQPropertyName = this.componentManager.getTargetFQPropertyName(this, property.name)

    this.stateManager.changed.on(targetFQPropertyName, this.handleStateChanged)

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

  private removeBinding(property: IComponentProperty): void {
    const targetFQPropertyName = this.componentManager.getTargetFQPropertyName(this, property.name)

    this.stateManager.changed.off(targetFQPropertyName, this.handleStateChanged)

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

  private readonly handleStateChanged: StateChangedHandler = (_fqPropertyName, newValue) => {
    this.platformParent?.setContent(this.normalize(newValue))
  }

  private normalize(value: unknown): string {
    if (value === null || value === undefined) {
      return ""
    }

    if (typeof value === "string") {
      return value
    }

    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value)
  }
}
