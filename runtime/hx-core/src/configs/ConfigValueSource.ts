import type { BindingType } from "@heleonix/hx-language"
import type { IValueSource } from "../bindings/IValueSource"
import type { ConfigDefinitionLoader } from "./ConfigDefinitionLoader"
import { CONFIG_ENTRY_SEPARATOR } from "@heleonix/hx-language"
import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"

export class ConfigValueSource implements IValueSource {
  public readonly type: BindingType = "config"

  public constructor(private readonly loader: ConfigDefinitionLoader) {}

  public async get(path: string): Promise<unknown> {
    const splitIndex = path.lastIndexOf(CONFIG_ENTRY_SEPARATOR)
    const name = path.slice(0, splitIndex)

    const definition = await this.loader.loadDefinition(name)

    if (!definition) {
      throw new HeleonixError(Errors.configDefinitionProviding, name)
    }

    return definition.entries[path.slice(splitIndex + 1)]
  }
}
