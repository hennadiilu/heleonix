import type { IStyleQualifier } from "./IStyleQualifier"

export interface IQualifierProvider {
  get(name: string): IStyleQualifier | undefined
}
