import type { BindingType } from "@heleonix/hx-language"
import type { IValueSource } from "../bindings/IValueSource"
import type { IState } from "./IState"

export class StateValueSource implements IValueSource {
  public readonly type: BindingType = "state"

  public constructor(private readonly state: IState) {}

  public get(path: string): unknown {
    return this.state.getValue(path)
  }
}
