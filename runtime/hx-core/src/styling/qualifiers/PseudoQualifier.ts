import type { IQualifierUsage } from "@heleonix/hx-language"
import { StyleQualifier } from "./StyleQualifier"
import type { StyleCondition } from "../StyleCondition"

export class PseudoQualifier extends StyleQualifier {
  public static readonly hxName = "Pseudo"

  public override build(usage: IQualifierUsage): StyleCondition {
    return { pseudo: usage.positional !== undefined ? `${usage.name}(${usage.positional})` : usage.name }
  }
}
