import type { FQConfigEntryName } from "@heleonix/hx-language"
import { BindingEvaluator } from "../bindings/BindingEvaluator"
import type { IConfigProvider } from "./IConfigProvider"

const NO_VALUES: object = Object.freeze({})

export class ConfigProvider implements IConfigProvider {
  public constructor(private readonly evaluator: BindingEvaluator) {}

  public get(fqEntryName: FQConfigEntryName): Promise<unknown> {
    return Promise.resolve(this.evaluator.resolve({ type: "config", value: fqEntryName }, NO_VALUES))
  }
}
