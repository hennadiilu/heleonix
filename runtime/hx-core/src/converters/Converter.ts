import type { DataParams } from "../common/DataParams"
import type { MaybePromise } from "../common/MaybePromise"
import type { IConverterContext } from "./IConverterContext"

export abstract class Converter<TValue = unknown, TReturn = unknown, TParams extends DataParams<TParams> = object> {
  public constructor(protected readonly context: IConverterContext) {}

  public abstract format(value: TValue, params: TParams): MaybePromise<TReturn>

  public abstract parse(value: TReturn, params: TParams): MaybePromise<TValue>
}
