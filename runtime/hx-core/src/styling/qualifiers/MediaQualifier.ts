import type { IQualifierUsage } from "@heleonix/hx-language"
import { StyleQualifier } from "./StyleQualifier"
import type { StyleCondition } from "../StyleCondition"

export class MediaQualifier extends StyleQualifier {
  public static readonly hxName = "Media"

  public override build(usage: IQualifierUsage): StyleCondition {
    return { environment: usage.args["query"] ?? "" }
  }
}
