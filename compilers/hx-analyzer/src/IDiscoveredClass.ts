import type { IMemberType } from "./IMemberType"

export interface IDiscoveredClass {
  className: string

  base: "Converter" | "Action"

  name: string

  hasHxName: boolean

  file: string

  line: number

  character: number

  docs?: string

  params: IMemberType[]
}
