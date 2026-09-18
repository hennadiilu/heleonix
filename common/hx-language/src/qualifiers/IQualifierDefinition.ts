import type { IQualifierArg } from "./IQualifierArg"

export interface IQualifierDefinition {
  name: string

  diName?: string

  args: IQualifierArg[]
}
