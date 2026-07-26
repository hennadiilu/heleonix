import { FrameworkElement } from "../FrameworkElement"
import { ConfigProvider } from "../configs/ConfigProvider"
import { Service } from "../services/Service"
import type { DataParams } from "../common/DataParams"

/**
 * Base class for actions: TypeScript classes run by the builtin `<Execute>`
 * component (`<Execute action="Submit" foo="…" />`). Declared directly in
 * TypeScript with no header - the analyzer discovers concrete subclasses by
 * this base type and reads the parameter contract from `TParams`
 * (`Parameters<Class["Execute"]>[0]`). The registry name is the class name
 * minus the required `Action` suffix (`SubmitAction` -> `Submit`); the DI token
 * is the full class name via `static diName`.
 *
 * `TParams` must be data (`DataParams` rejects function-typed members at any
 * depth). A `readonly` parameter is an input - any binding source may be bound
 * (dictionary, config, literal, state, prop); a mutable parameter is in-out and
 * the action writes back to it, so it must bind a writable state/prop path.
 * `Execute` returns void; actions may inject services and the config provider.
 */
export abstract class Action<TParams extends DataParams<TParams> = object> extends FrameworkElement<
  Service | ConfigProvider
> {
  public abstract Execute(params: TParams): Promise<void>
}
