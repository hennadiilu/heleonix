import type { Converter } from "./Converter"
import type { IConverterContext } from "./IConverterContext"

export type ConverterConstructor = {
  readonly hxName: string

  new (context: IConverterContext): Converter
}
