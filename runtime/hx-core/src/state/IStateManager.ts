import type { FQPropertyName } from "@heleonix/hx-language"
import type { IState } from "./IState"

export interface IStateManager extends IState {
  bind(target: FQPropertyName, source: FQPropertyName): void

  unbind(target: FQPropertyName, source: FQPropertyName): void
}
