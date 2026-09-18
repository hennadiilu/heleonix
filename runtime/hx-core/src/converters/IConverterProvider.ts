import type { Converter } from "./Converter"

export interface IConverterProvider {
  get(name: string): Converter
}
