import type { FQDictionaryEntryName } from "@heleonix/hx-language"
import { BindingEvaluator } from "../bindings/BindingEvaluator"
import type { DataObject } from "../common/DataObject"
import type { IDictionaryProvider } from "./IDictionaryProvider"

const NO_VALUES: object = Object.freeze({})

export class DictionaryProvider implements IDictionaryProvider {
  public constructor(private readonly evaluator: BindingEvaluator) {}

  public get<TValues extends DataObject<TValues>>(
    fqEntryName: FQDictionaryEntryName,
    values?: TValues,
  ): Promise<string | undefined> {
    return Promise.resolve(
      this.evaluator.resolve({ type: "dictionary", value: fqEntryName }, values ?? NO_VALUES),
    ) as Promise<string | undefined>
  }
}
