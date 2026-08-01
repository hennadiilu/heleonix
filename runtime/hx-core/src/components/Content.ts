import { Component } from "./Component"
import type { IComponentDefinition, IComponentProperty, IComponentUsage } from "@heleonix/hx-language"
import { ComponentManager } from "./ComponentManager"
import { StateManager } from "../state/StateManager"
import { StateChangedHandler } from "../state/StateChangedHandler"
import { Binder } from "../bindings/Binder"
import type { PlatformComponent } from "./PlatformComponent"

const VALUE_PROPERTY = "value"

export class Content extends Component {
  protected readonly stateManager = this.inject(StateManager)

  protected readonly binder = this.inject(Binder)

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
    } else if (oldProp && newProp) {
      this.binder.refresh(
        this.componentManager.getTargetFQPropertyName(this, newProp.name),
        newProp.binding,
        this.scopedParent?.fqName ?? "",
      )
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
    return (
      oldProp.binding.type !== newProp.binding.type ||
      oldProp.binding.value !== newProp.binding.value ||
      (oldProp.binding.converters ?? []).join("|") !== (newProp.binding.converters ?? []).join("|")
    )
  }

  private async applyBinding(property: IComponentProperty): Promise<void> {
    const targetFQPropertyName = this.componentManager.getTargetFQPropertyName(this, property.name)

    // Subscribe before binding so the binder's initial write renders the first
    // value as content through this handler.
    this.stateManager.changed.on(targetFQPropertyName, this.handleStateChanged)

    await this.binder.bind(targetFQPropertyName, property.binding, this.scopedParent?.fqName ?? "")
  }

  private removeBinding(property: IComponentProperty): void {
    const targetFQPropertyName = this.componentManager.getTargetFQPropertyName(this, property.name)

    this.stateManager.changed.off(targetFQPropertyName, this.handleStateChanged)

    this.binder.unbind(targetFQPropertyName)
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
