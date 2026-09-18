import type { IQualifierUsage } from "@heleonix/hx-language"
import { StyleQualifier } from "./StyleQualifier"
import type { StyleFragment } from "../StyleFragment"

export class MediaQualifier extends StyleQualifier {
  public static readonly hxName = "Media"

  public build(usage: IQualifierUsage): StyleFragment {
    return { environment: usage.args["query"] ?? "" }
  }
}
