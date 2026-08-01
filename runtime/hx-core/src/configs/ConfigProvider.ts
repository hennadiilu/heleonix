import type { FQConfigEntryName } from "@heleonix/hx-language"
import { FrameworkElement } from "../FrameworkElement"
import { ConfigDefinitionProvider } from "./ConfigDefinitionProvider"
import { resolveConfigEntry } from "./resolveConfigEntry"

/**
 * Read-only access to compiled config values, resolved through the dimension-
 * selected {@link ConfigDefinitionProvider}. Injected by converters and actions
 * that may read a config value; the binding engine resolves config through the
 * {@link BindingEvaluator} instead, so both share {@link resolveConfigEntry}.
 */
export class ConfigProvider extends FrameworkElement<ConfigDefinitionProvider> {
  private readonly configDefinitionProvider = this.inject(ConfigDefinitionProvider)

  public static get diName(): string {
    return "ConfigProvider"
  }

  public getValue(entry: FQConfigEntryName): Promise<unknown> {
    return resolveConfigEntry(this.configDefinitionProvider, entry)
  }
}
