import { Component } from "./Component"
import type { IComponentDefinition, IComponentProperty, IComponentUsage } from "@heleonix/hx-language"
import { ComponentManager } from "./ComponentManager"
import { StateManager } from "../state/StateManager"
import { StateChangedHandler } from "../state/StateChangedHandler"
import { Binder } from "../bindings/Binder"
import { reconcileBindings } from "./reconcileBindings"

export abstract class PlatformComponent extends Component {
  protected readonly stateManager = this.inject(StateManager)

  protected readonly binder = this.inject(Binder)

  protected readonly componentManager = this.inject(ComponentManager)

  public override async build(
    fqName: string,
    definition: IComponentDefinition,
    usage: IComponentUsage,
    parent: Component | undefined,
    scopedParent: Component | undefined,
    platformParent: PlatformComponent | undefined,
  ): Promise<void> {
    await super.build(fqName, definition, usage, parent, scopedParent, platformParent)

    await this.applyBindings(usage.properties)

    if (usage.children) {
      for (const childUsage of usage.children) {
        const child = await this.componentManager.buildComponent(childUsage, this, scopedParent, this)

        if (child.parent === this) {
          this.appendChild(child)
        }

        child.mount()
      }
    }
  }

  public override async update(newDefinition: IComponentDefinition, newUsage: IComponentUsage): Promise<void> {
    await reconcileBindings(
      this.usage.properties,
      newUsage.properties,
      (property) => this.applyBinding(property),
      (property) => this.removeBinding(property),
      (property) => this.refreshBinding(property),
    )

    await this.componentManager.reconcileChildren(this, newUsage.children, this, this.scopedParent, this)

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

    // Subscribe before binding so the binder's initial write pushes the first
    // value to the platform element through this handler.
    this.stateManager.changed.on(targetFQPropertyName, this.handleStateChanged)

    await this.binder.bind(targetFQPropertyName, property.binding, this.scopedParent?.fqName ?? "")
  }

  private removeBinding(property: IComponentProperty): void {
    const targetFQPropertyName = this.componentManager.getTargetFQPropertyName(this, property.name)

    this.stateManager.changed.off(targetFQPropertyName, this.handleStateChanged)

    this.binder.unbind(targetFQPropertyName)
  }

  // Re-resolves a surviving binding on a dimension switch. The view-sync
  // subscription stays put; the binder's rewrite flows the new value through it.
  private refreshBinding(property: IComponentProperty): void {
    this.binder.refresh(
      this.componentManager.getTargetFQPropertyName(this, property.name),
      property.binding,
      this.scopedParent?.fqName ?? "",
    )
  }

  private removeBindings(properties: IComponentProperty[] | undefined): void {
    if (!properties) {
      return
    }

    for (const property of properties) {
      this.removeBinding(property)
    }
  }

  private handleStateChanged: StateChangedHandler = (fqPropertyName, newValue) => {
    const localName = this.componentManager.getTargetScopedPropertyName(this, fqPropertyName)

    this.setProperty(localName, newValue)
  }

  public abstract setProperty(property: string, value: unknown): void

  public abstract setContent(text: string): void
}
