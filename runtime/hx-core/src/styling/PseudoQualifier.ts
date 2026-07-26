import type { IQualifierUsage } from "@heleonix/hx-language"
import { StyleQualifier } from "./StyleQualifier"
import { pseudoFragment } from "./pseudoFragment"
import type { StyleFragment } from "./StyleFragment"

/**
 * The built-in selector qualifier for every CSS pseudo-class/element. Registered
 * as the {@link QualifierRegistry} default, so any rule-key segment that is not a
 * known framework qualifier is treated as a pseudo - no name dataset needed.
 * Pure `build`; the platform maps the neutral fragment to `:`/`::` CSS.
 */
export class PseudoQualifier extends StyleQualifier {
  public static get diName(): string {
    return "PseudoQualifier"
  }

  public build(usage: IQualifierUsage): StyleFragment {
    return pseudoFragment(usage)
  }
}
