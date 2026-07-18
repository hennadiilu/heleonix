import type { IDictionaryDefinition } from "@heleonix/hx-language"
import type { IDimension } from "@heleonix/hx-language"
import { FrameworkElement } from "../FrameworkElement"
import { ConfigProvider } from "../configs/ConfigProvider"
import { Service } from "../services/Service"

export abstract class DictionaryDefinitionSource extends FrameworkElement<ConfigProvider | Service> {
  public abstract getDefinitions(name: string, dimension: IDimension): Promise<readonly IDictionaryDefinition[]>
}
