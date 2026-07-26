import { FrameworkElement } from "../FrameworkElement"
import { ConfigProvider } from "../configs/ConfigProvider"
import { DictionaryProvider } from "../dictionaries/DictionaryProvider"
import type { DataParams } from "../common/DataParams"

/**
 * Base class for converters: TypeScript classes that transform a bound value
 * on the way to the view (`format`) and back to state (`parse`). Declared
 * directly in TypeScript with no header - the analyzer discovers concrete
 * subclasses by this base type and reads the argument contract from `TParams`
 * (`Parameters<Class["format"]>[1]`). The binding name is the class name minus
 * the required `Converter` suffix (`TruncateConverter` -> `Truncate`); the DI
 * token is the full class name via `static diName`.
 *
 * `TParams` must be data (`DataParams` rejects function-typed members - those
 * are events). Converters may inject other converters and the dictionary/config
 * providers.
 */
export abstract class Converter<
  TValue = unknown,
  TReturn = unknown,
  TParams extends DataParams<TParams> = object,
> extends FrameworkElement<Converter<unknown, unknown, object> | DictionaryProvider | ConfigProvider> {
  public abstract format(value: TValue, params: TParams): Promise<TReturn>

  public abstract parse(value: TReturn, params: TParams): Promise<TValue>
}
