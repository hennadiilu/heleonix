import { Component } from "./Component"
import type { IComponentDefinition, IComponentUsage } from "@heleonix/hx-language"
import type { PlatformComponent } from "./PlatformComponent"
import { ComponentManager } from "./ComponentManager"

export class Children extends Component {
  protected readonly componentManager = this.inject(ComponentManager)

  public static get diName(): string {
    return "Children"
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

    if (scopedParent && scopedParent.usage.children) {
      for (const childUsage of scopedParent.usage.children) {
        const child = await this.componentManager.buildComponent(childUsage, parent, scopedParent, platformParent)

        this.appendChild(child)

        child.mount()
      }
    }
  }

  public override async update(newDefinition: IComponentDefinition, newUsage: IComponentUsage): Promise<void> {
    await this.componentManager.reconcileChildren(
      this,
      this.scopedParent?.usage.children,
      this.parent,
      this.scopedParent,
      this.platformParent,
    )

    await super.update(newDefinition, newUsage)
  }

  public override destroy(): void {
    for (const child of [...this.children]) {
      child.unmount()
      this.removeChild(child)

      this.componentManager.destroyComponent(child)
    }

    super.destroy()
  }
}
