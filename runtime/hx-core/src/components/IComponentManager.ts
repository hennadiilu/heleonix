import type { FQPropertyName, IComponentUsage } from "@heleonix/hx-language"
import type { Component } from "./Component"
import type { PlatformComponent } from "./PlatformComponent"

export interface IComponentManager {
  build(
    usage: IComponentUsage,
    parent: Component | undefined,
    scopedParent: Component | undefined,
    platformParent: PlatformComponent | undefined,
  ): Promise<Component>

  update(component: Component, newUsage: IComponentUsage): Promise<void>

  destroy(component: Component): void

  getTargetFQPropertyName(component: Component, propertyName: string): FQPropertyName

  getTargetScopedPropertyName(component: Component, fqPropertyName: FQPropertyName): string
}
