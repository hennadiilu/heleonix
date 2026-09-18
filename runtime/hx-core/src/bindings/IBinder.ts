import type { FQComponentName, FQPropertyName, IBindingExpression } from "@heleonix/hx-language"
import type { MaybePromise } from "../common/MaybePromise"
import type { IKeyedEventEmitter } from "../common/IKeyedEventEmitter"
import type { BindingEndpointHandler } from "./BindingEndpointHandler"

export interface IBinder {
  readonly endpointActivated: IKeyedEventEmitter<FQComponentName, BindingEndpointHandler>

  readonly endpointDeactivated: IKeyedEventEmitter<FQComponentName, BindingEndpointHandler>

  bind(targetFQ: FQPropertyName, binding: IBindingExpression, scopeFQ: FQComponentName): MaybePromise<void>

  unbind(targetFQ: FQPropertyName): void

  rebind(targetFQ: FQPropertyName, binding: IBindingExpression, scopeFQ: FQComponentName): void

  getActiveEndpoints(componentFQ: FQComponentName): readonly string[]
}
