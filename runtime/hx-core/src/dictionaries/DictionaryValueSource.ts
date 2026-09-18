import { DICTIONARY_ENTRY_SEPARATOR } from "@heleonix/hx-language"
import type { BindingType, FQDictionaryEntryName } from "@heleonix/hx-language"
import type { IValueSource } from "../bindings/IValueSource"
import { DictionaryDefinitionLoader } from "./DictionaryDefinitionLoader"
import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"

export class DictionaryValueSource implements IValueSource {
  public readonly type: BindingType = "dictionary"

  public constructor(private readonly loader: DictionaryDefinitionLoader) {}

  public async get(path: FQDictionaryEntryName): Promise<string | undefined> {
    const splitIndex = path.lastIndexOf(DICTIONARY_ENTRY_SEPARATOR)
    const name = path.slice(0, splitIndex)

    const definition = await this.loader.loadDefinition(name)

    if (!definition) {
      throw new HeleonixError(Errors.dictionaryDefinitionProviding, name)
    }

    return definition.entries[path.slice(splitIndex + 1)]
  }
}
