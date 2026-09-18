import type { IStyleQualifier } from "./IStyleQualifier"
import type { IStyleQualifierContext } from "./IStyleQualifierContext"
import type { StyleQualifier } from "./StyleQualifier"

export type StyleQualifierConstructor = {
  readonly hxName: string

  new (context: IStyleQualifierContext): StyleQualifier & IStyleQualifier
}
