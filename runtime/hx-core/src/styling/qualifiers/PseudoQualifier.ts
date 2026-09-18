import type { IQualifierUsage } from "@heleonix/hx-language"
import { StyleQualifier } from "./StyleQualifier"
import type { StyleFragment } from "../StyleFragment"

export class PseudoQualifier extends StyleQualifier {
  public static readonly hxName = "Pseudo"

  public build(usage: IQualifierUsage): StyleFragment {
    return { pseudo: usage.positional !== undefined ? `${usage.name}(${usage.positional})` : usage.name }
  }
}
