import { Component } from "./Component"
import type { IComponentDefinition, IComponentUsage } from "@heleonix/hx-language"
import type { PlatformComponent } from "./PlatformComponent"

export class Children extends Component {
  public static readonly hxName = "Children"

  public override async build(
    fqName: string,
    definition: IComponentDefinition,
    usage: IComponentUsage,
    parent: Component | undefined,
    scopedParent: Component | undefined,
    platformParent: PlatformComponent | undefined,
  ): Promise<void> {
    await super.build(fqName, definition, usage, parent, scopedParent, platformParent)

    await this.attachChildren(scopedParent?.usage.children, parent, scopedParent, platformParent)
  }

  public override async update(newDefinition: IComponentDefinition, newUsage: IComponentUsage): Promise<void> {
    await this.reconcileChildren(this.scopedParent?.usage.children, this.parent, this.scopedParent, this.platformParent)

    await super.update(newDefinition, newUsage)
  }
}
