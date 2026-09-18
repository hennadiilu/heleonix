import { Component } from "./Component"
import type { IComponentDefinition, IComponentProperty, IComponentUsage } from "@heleonix/hx-language"
import type { PlatformComponent } from "./PlatformComponent"
import type { MaybePromise } from "../common/MaybePromise"
import { thenMaybe } from "../common/thenMaybe"
import { reconcileBindings } from "./reconcileBindings"

export class DeclarativeComponent extends Component {
  public static readonly hxName = "DeclarativeComponent"

  public override async build(
    fqName: string,
    definition: IComponentDefinition,
    usage: IComponentUsage,
    parent: Component | undefined,
    scopedParent: Component | undefined,
    platformParent: PlatformComponent | undefined,
  ): Promise<void> {
    await super.build(fqName, definition, usage, parent, this, platformParent)

    await this.applyBindings(usage.properties)

    await this.attachChildren(definition.children, this, this, platformParent)
  }

  public override async update(newDefinition: IComponentDefinition, newUsage: IComponentUsage): Promise<void> {
    await reconcileBindings(
      this.usage.properties,
      newUsage.properties,
      this.applyBinding,
      this.removeBinding,
      this.refreshBinding,
    )

    await this.reconcileChildren(newDefinition.children, this, this, this.platformParent)

    await super.update(newDefinition, newUsage)
  }

  public override destroy(): void {
    this.removeBindings(this.usage.properties)

    super.destroy()
  }

  private applyBindings(properties: IComponentProperty[] | undefined): MaybePromise<void> {
    let chain: MaybePromise<void> = undefined

    for (const property of properties ?? []) {
      chain = thenMaybe(chain, () => this.applyBinding(property))
    }

    return chain
  }

  private applyBinding = (property: IComponentProperty): MaybePromise<void> => {
    const targetFQPropertyName = this.context.components.getTargetFQPropertyName(this, property.name)

    return this.context.binder.bind(targetFQPropertyName, property.binding, this.scopedParent?.fqName ?? "")
  }

  private removeBindings(properties: IComponentProperty[] | undefined): void {
    if (!properties) {
      return
    }

    for (const property of properties) {
      this.removeBinding(property)
    }
  }

  private removeBinding = (property: IComponentProperty): void => {
    this.context.binder.unbind(this.context.components.getTargetFQPropertyName(this, property.name))
  }

  private refreshBinding = (property: IComponentProperty): void => {
    this.context.binder.rebind(
      this.context.components.getTargetFQPropertyName(this, property.name),
      property.binding,
      this.scopedParent?.fqName ?? "",
    )
  }
}
