import type { DataObject } from "../common/DataObject"
import type { MaybePromise } from "../common/MaybePromise"
import type { IConverterContext } from "./IConverterContext"

export abstract class Converter<TValue = unknown, TReturn = unknown, TParams extends DataObject<TParams> = object> {
  // True when `format`/`parse` read dictionaries or configs through the context,
  // so a dimension switch re-resolves every binding the converter is part of.
  public readonly isDimensionSensitive: boolean = false

  public constructor(protected readonly context: IConverterContext) {}

  public abstract format(value: TValue, params: TParams): MaybePromise<TReturn>

  public abstract parse(value: TReturn, params: TParams): MaybePromise<TValue>
}
