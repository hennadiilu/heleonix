import type { BindingType } from "@heleonix/hx-language"
import type { IValueSource } from "./IValueSource"

export class LiteralValueSource implements IValueSource {
  public readonly type: BindingType = "literal"

  public get(path: string): unknown {
    return JSON.parse(path)
  }
}
