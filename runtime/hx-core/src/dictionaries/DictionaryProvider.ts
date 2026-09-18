import type { FQComponentName, FQDictionaryEntryName } from "@heleonix/hx-language"
import { BindingEvaluator } from "../bindings/BindingEvaluator"
import type { IDictionaryProvider } from "./IDictionaryProvider"

export class DictionaryProvider implements IDictionaryProvider {
  public constructor(private readonly evaluator: BindingEvaluator) {}

  public get(path: FQDictionaryEntryName, scopeFQ: FQComponentName): Promise<string | undefined> {
    return Promise.resolve(this.evaluator.resolve({ type: "dictionary", value: path }, scopeFQ)) as Promise<
      string | undefined
    >
  }
}
