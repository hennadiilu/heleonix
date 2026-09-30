import { Component } from "./Component"
import type { IComponentDefinition, IComponentProperty, IComponentUsage } from "@heleonix/hx-language"
import { StateChangedHandler } from "../state/StateChangedHandler"
import type { BindingEndpointHandler } from "../bindings/BindingEndpointHandler"
import type { MaybePromise } from "../common/MaybePromise"
import { thenMaybe } from "../common/thenMaybe"
import { reconcileBindings } from "./reconcileBindings"

export abstract class PlatformComponent extends Component {
  protected override get ownHost(): PlatformComponent {
    return this
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

    this.context.binder.endpointActivated.on(this.fqName, this.handleEndpointActivated)
    this.context.binder.endpointDeactivated.on(this.fqName, this.handleEndpointDeactivated)

    for (const localPath of this.context.binder.getActiveEndpoints(this.fqName)) {
      this.activateBinding(localPath)
    }

    await this.applyBindings(usage.properties)

    await this.attachChildren(usage.children, this, scopedParent, this)
  }

  public override async update(newDefinition: IComponentDefinition, newUsage: IComponentUsage): Promise<void> {
    await reconcileBindings(
      this.usage.properties,
      newUsage.properties,
      this.applyBinding,
      this.removeBinding,
      this.refreshBinding,
    )

    await this.reconcileChildren(newUsage.children, this, this.scopedParent, this)

    await super.update(newDefinition, newUsage)
  }

  public override destroy(): void {
    this.context.binder.endpointActivated.off(this.fqName, this.handleEndpointActivated)
    this.context.binder.endpointDeactivated.off(this.fqName, this.handleEndpointDeactivated)

    this.removeBindings(this.usage.properties)

    super.destroy()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public activateBinding(localPath: string): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public deactivateBinding(localPath: string): void {}

  private applyBindings(properties: IComponentProperty[] | undefined): MaybePromise<void> {
    let chain: MaybePromise<void> = undefined

    for (const property of properties ?? []) {
      chain = thenMaybe(chain, () => this.applyBinding(property))
    }

    return chain
  }

  private applyBinding = (property: IComponentProperty): MaybePromise<void> => {
    const targetFQPropertyName = this.context.components.getTargetFQPropertyName(this, property.name)

    // Subscribe before binding so the binder's initial write pushes the first
    // value to the platform element through this handler.
    this.context.state.changed.on(targetFQPropertyName, this.handleStateChanged)

    return this.context.binder.bind(targetFQPropertyName, property.binding, this.scopedParent?.fqName ?? "")
  }

  private removeBinding = (property: IComponentProperty): void => {
    const targetFQPropertyName = this.context.components.getTargetFQPropertyName(this, property.name)

    this.context.state.changed.off(targetFQPropertyName, this.handleStateChanged)

    this.context.binder.unbind(targetFQPropertyName)
  }

  // Re-resolves a surviving binding on a dimension switch. The view-sync
  // subscription stays put; the binder's rewrite flows the new value through it.
  private refreshBinding = (property: IComponentProperty): void => {
    this.context.binder.rebind(
      this.context.components.getTargetFQPropertyName(this, property.name),
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

  private readonly handleEndpointActivated: BindingEndpointHandler = (_fqComponentName, localPath) => {
    this.activateBinding(localPath)
  }

  private readonly handleEndpointDeactivated: BindingEndpointHandler = (_fqComponentName, localPath) => {
    this.deactivateBinding(localPath)
  }

  private handleStateChanged: StateChangedHandler = (fqPropertyName, newValue) => {
    const localName = this.context.components.getTargetScopedPropertyName(this, fqPropertyName)

    this.setProperty(localName, newValue)
  }

  public abstract override mount(anchor?: PlatformComponent): void

  public abstract setProperty(property: string, value: unknown): void

  public abstract setContent(text: string): void
}
