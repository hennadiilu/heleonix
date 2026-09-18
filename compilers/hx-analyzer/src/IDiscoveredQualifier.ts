import type { IQualifierArg } from "@heleonix/hx-language"

export interface IDiscoveredQualifier {
  className: string

  name: string

  hasHxName: boolean

  file: string

  line: number

  character: number

  docs?: string

  args: IQualifierArg[]
}
