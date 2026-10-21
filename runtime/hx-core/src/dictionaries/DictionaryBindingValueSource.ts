import { DICTIONARY_ENTRY_SEPARATOR } from "@heleonix/hx-language"
import type { BindingType, FQDictionaryEntryName } from "@heleonix/hx-language"
import type { IBindingValueSource } from "../bindings/IBindingValueSource"
import { DictionaryDefinitionLoader } from "./DictionaryDefinitionLoader"
import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"

export class DictionaryBindingValueSource implements IBindingValueSource {
  public readonly type: BindingType = "dictionary"

  public constructor(private readonly loader: DictionaryDefinitionLoader) {}

  public async get(fqEntryName: FQDictionaryEntryName): Promise<string | undefined> {
    const splitIndex = fqEntryName.lastIndexOf(DICTIONARY_ENTRY_SEPARATOR)
    const name = fqEntryName.slice(0, splitIndex)

    const definition = await this.loader.loadDefinition(name)

    if (!definition) {
      throw new HeleonixError(Errors.dictionaryDefinitionProviding, name)
    }

    return definition.entries[fqEntryName.slice(splitIndex + 1)]
  }
}
