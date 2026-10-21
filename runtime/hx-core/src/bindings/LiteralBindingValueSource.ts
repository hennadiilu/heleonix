import type { BindingType } from "@heleonix/hx-language"
import type { IBindingValueSource } from "./IBindingValueSource"

export class LiteralBindingValueSource implements IBindingValueSource {
  public readonly type: BindingType = "literal"

  public get(path: string): unknown {
    return JSON.parse(path)
  }
}
