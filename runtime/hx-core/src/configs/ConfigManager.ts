import { ConfigDefinitionProvider } from "./ConfigDefinitionProvider"
import { FrameworkElement } from "../FrameworkElement"
import { CONFIG_ENTRY_SEPARATOR, FQConfigEntryName, FQPropertyName } from "@heleonix/hx-language"
import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"
import { StateManager } from "../state/StateManager"

export class ConfigManager extends FrameworkElement<ConfigDefinitionProvider | StateManager> {
  private readonly configDefinitionProvider = this.inject(ConfigDefinitionProvider)

  private readonly stateManager = this.inject(StateManager)

  public static get diName(): string {
    return "ConfigManager"
  }

  public async getValue(entry: FQConfigEntryName): Promise<unknown> {
    const splitIndex = entry.lastIndexOf(CONFIG_ENTRY_SEPARATOR)
    const name = entry.slice(0, splitIndex)

    const definition = await this.configDefinitionProvider.getDefinition(name)

    if (!definition) {
      throw new HeleonixError(Errors.configDefinitionProviding, name)
    }

    return definition.entries[entry.slice(splitIndex + 1)]
  }

  public async bind(targetFQ: FQPropertyName, entryName: FQConfigEntryName): Promise<void> {
    const value = await this.getValue(entryName)

    if (value === undefined) {
      throw new HeleonixError(Errors.configEntryRetrieval, entryName)
    }

    this.stateManager.setValue(targetFQ, value)
  }

  public unbind(targetFQ: FQPropertyName): void {
    void targetFQ
  }
}
