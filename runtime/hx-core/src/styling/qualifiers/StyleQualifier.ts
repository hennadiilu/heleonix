import type { IStyleQualifierContext } from "./IStyleQualifierContext"

export abstract class StyleQualifier<TArgs = object> {
  // The typed argument contract - read by the analyzer's class scan, never at
  // runtime. `declare` keeps it type-only, with no field emitted.
  declare protected readonly args: TArgs

  public constructor(protected readonly context: IStyleQualifierContext) {}
}
