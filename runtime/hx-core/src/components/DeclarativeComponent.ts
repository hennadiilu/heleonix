import { Component } from "./Component"
import type { IComponentDefinition, IComponentProperty, IComponentUsage } from "@heleonix/hx-language"
import { ComponentManager } from "./ComponentManager"
import type { PlatformComponent } from "./PlatformComponent"
import { Binder } from "../bindings/Binder"
import { reconcileBindings } from "./reconcileBindings"

export class DeclarativeComponent extends Component {
  protected readonly binder = this.inject(Binder)

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
    await reconcileBindings(
      this.usage.properties,
      newUsage.properties,
      (property) => this.applyBinding(property),
      (property) => this.removeBinding(property),
      (property) => this.refreshBinding(property),
    )

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

    await this.binder.bind(targetFQPropertyName, property.binding, this.scopedParent?.fqName ?? "")
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
    this.binder.unbind(this.componentManager.getTargetFQPropertyName(this, property.name))
  }

  private refreshBinding(property: IComponentProperty): void {
    this.binder.refresh(
      this.componentManager.getTargetFQPropertyName(this, property.name),
      property.binding,
      this.scopedParent?.fqName ?? "",
    )
  }
}
