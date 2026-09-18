import type { IMemberType } from "./IMemberType"

export interface IComponentInfo {
  name: string

  docs?: string

  open: boolean

  members: IMemberType[]

  file?: string

  line?: number

  character?: number
}
