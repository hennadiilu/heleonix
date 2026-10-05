import type { IStyleQualifier } from "./IStyleQualifier"
import type { StyleQualifier } from "./StyleQualifier"

export type StyleQualifierConstructor = {
  readonly hxName: string

  new (): StyleQualifier & IStyleQualifier
}
