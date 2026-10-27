import type { StyleQualifier } from "./StyleQualifier"

export interface IQualifierProvider {
  get(name: string): StyleQualifier | undefined
}
