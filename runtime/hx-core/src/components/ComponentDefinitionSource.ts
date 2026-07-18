import type { IComponentDefinition } from "@heleonix/hx-language"
import type { IDimension } from "@heleonix/hx-language"
import { FrameworkElement } from "../FrameworkElement"
import { Service } from "../services/Service"
import { ConfigProvider } from "../configs/ConfigProvider"

export abstract class ComponentDefinitionSource extends FrameworkElement<ConfigProvider | Service> {
  public abstract getDefinitions(name: string, dimension: IDimension): Promise<readonly IComponentDefinition[]>
}
