import type { IMemberType } from "./IMemberType"

export interface IConverterActionInfo {
  name: string

  params: IMemberType[]

  docs?: string

  file?: string

  line?: number

  character?: number
}
