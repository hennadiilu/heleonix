import { DictionaryDefinitionProvider } from "./DictionaryDefinitionProvider"
import { FrameworkElement } from "../FrameworkElement"
import { CLOSE, OPEN, extractParameters, interpolate } from "@heleonix/hx-language"
import {
  DICTIONARY_ENTRY_SEPARATOR,
  FQComponentName,
  FQDictionaryEntryName,
  FQPropertyName,
  joinFQPropertyName,
} from "@heleonix/hx-language"
import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"
import { StateManager } from "../state/StateManager"
import { StateChangedHandler } from "../state/StateChangedHandler"

interface DictionaryBindingRecord {
  entryName: FQDictionaryEntryName
  parameterScopeFQ: FQComponentName
  parameters: string[]
  handler: StateChangedHandler
}

function stripDelimiters(raw: string): string {
  if (raw.length >= 2 && raw.charAt(0) === OPEN && raw.charAt(raw.length - 1) === CLOSE) {
    return raw.slice(1, -1)
  }

  return raw
}

export class DictionaryManager extends FrameworkElement<DictionaryDefinitionProvider | StateManager> {
  private readonly dictionaryDefinitionProvider = this.inject(DictionaryDefinitionProvider)

  private readonly stateManager = this.inject(StateManager)

  private readonly bindings = new Map<FQPropertyName, DictionaryBindingRecord>()

  public static get diName(): string {
    return "DictionaryManager"
  }

  public async getValue(
    path: FQDictionaryEntryName,
    parameterGetter: (raw: string) => unknown,
  ): Promise<string | undefined> {
    const template = await this.getEntry(path)

    if (template === undefined) {
      return undefined
    }

    return this.interpolate(template, parameterGetter)
  }

  public async bind(
    targetFQ: FQPropertyName,
    entryName: FQDictionaryEntryName,
    parameterScopeFQ: FQComponentName,
  ): Promise<void> {
    this.unbind(targetFQ)

    const template = await this.getEntry(entryName)

    if (template === undefined) {
      throw new HeleonixError(Errors.dictionaryEntryRetrieval, entryName)
    }

    const parameters = extractParameters(template)

    const record: DictionaryBindingRecord = {
      entryName,
      parameterScopeFQ,
      parameters,
      handler: () => void this.recompute(targetFQ, record),
    }

    for (const param of parameters) {
      this.stateManager.changed.on(joinFQPropertyName(parameterScopeFQ, param), record.handler)
    }

    this.bindings.set(targetFQ, record)

    await this.recompute(targetFQ, record)
  }

  public unbind(targetFQ: FQPropertyName): void {
    const record = this.bindings.get(targetFQ)

    if (!record) {
      return
    }

    for (const param of record.parameters) {
      this.stateManager.changed.off(joinFQPropertyName(record.parameterScopeFQ, param), record.handler)
    }

    this.bindings.delete(targetFQ)
  }

  // TODO: Implement usage of Converters and Intl API: "abc {param | converter} def"
  private interpolate(template: string, parameterGetter: (raw: string) => unknown): string {
    return interpolate(template, (raw) => parameterGetter(stripDelimiters(raw)))
  }

  private async getEntry(path: FQDictionaryEntryName): Promise<string | undefined> {
    const splitIndex = path.lastIndexOf(DICTIONARY_ENTRY_SEPARATOR)
    const name = path.slice(0, splitIndex)

    const definition = await this.dictionaryDefinitionProvider.getDefinition(name)

    if (!definition) {
      throw new HeleonixError(Errors.dictionaryDefinitionProviding, name)
    }

    return definition.entries[path.slice(splitIndex + 1)]
  }

  private async recompute(targetFQ: FQPropertyName, record: DictionaryBindingRecord): Promise<void> {
    const value = await this.getValue(record.entryName, (param) =>
      this.stateManager.getValue(joinFQPropertyName(record.parameterScopeFQ, param)),
    )

    if (value === undefined) {
      return
    }

    this.stateManager.setValue(targetFQ, value)
  }
}
