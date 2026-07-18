import type { IConfigDefinition } from "@heleonix/hx-language"
import type { IDimension } from "@heleonix/hx-language"
import { FrameworkElement } from "../FrameworkElement"
import { ConfigProvider } from "./ConfigProvider"
import { Service } from "../services/Service"

export abstract class ConfigDefinitionSource extends FrameworkElement<ConfigProvider | Service> {
  public abstract getDefinitions(name: string, dimension: IDimension): Promise<readonly IConfigDefinition[]>
}
