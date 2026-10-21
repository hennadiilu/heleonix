import type { BindingType } from "@heleonix/hx-language"
import type { IBindingValueSource } from "../bindings/IBindingValueSource"
import type { IState } from "./IState"

export class StateBindingValueSource implements IBindingValueSource {
  public readonly type: BindingType = "state"

  public constructor(private readonly state: IState) {}

  public get(path: string): unknown {
    return this.state.getValue(path)
  }
}
