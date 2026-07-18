import type { FQConfigEntryName } from "@heleonix/hx-language"
import { FrameworkElement } from "../FrameworkElement"
import { ConfigManager } from "./ConfigManager"

export class ConfigProvider extends FrameworkElement<ConfigManager> {
  private readonly configManager = this.inject(ConfigManager)

  public static get diName(): string {
    return "ConfigProvider"
  }

  public getValue(entry: FQConfigEntryName): Promise<unknown> {
    return this.configManager.getValue(entry)
  }
}
