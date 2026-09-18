import type { FQPropertyName } from "@heleonix/hx-language"
import type { IKeyedEventEmitter } from "../common/IKeyedEventEmitter"
import type { StateChangedHandler } from "./StateChangedHandler"

export interface IState {
  readonly changed: IKeyedEventEmitter<FQPropertyName, StateChangedHandler>

  getValue(fqPropertyName: FQPropertyName): unknown

  setValue(fqPropertyName: FQPropertyName, value: unknown): void

  emitEvent(eventRootFQ: FQPropertyName, payload: object): void
}
