import type { IMemberType } from "./IMemberType"

export interface IDiscoveredComponent {
  className: string

  name: string

  hasHxName: boolean

  file: string

  line: number

  character: number

  docs?: string

  props: IMemberType[]

  events: IMemberType[]
}
