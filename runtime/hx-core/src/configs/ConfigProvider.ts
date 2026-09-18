import type { FQConfigEntryName } from "@heleonix/hx-language"
import { BindingEvaluator } from "../bindings/BindingEvaluator"
import type { IConfigProvider } from "./IConfigProvider"

export class ConfigProvider implements IConfigProvider {
  public constructor(private readonly evaluator: BindingEvaluator) {}

  public get(entry: FQConfigEntryName): Promise<unknown> {
    return Promise.resolve(this.evaluator.resolve({ type: "config", value: entry }, ""))
  }
}
