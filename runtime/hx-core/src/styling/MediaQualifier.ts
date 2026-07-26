import type { IQualifierUsage } from "@heleonix/hx-language"
import { StyleQualifier } from "./StyleQualifier"
import { mediaFragment } from "./mediaFragment"
import type { StyleFragment } from "./StyleFragment"

/**
 * The built-in selector qualifier for `@media`, registered under `Media`. Pure
 * `build`; the platform wraps the neutral `environment` fragment in an `@media`
 * at-rule.
 */
export class MediaQualifier extends StyleQualifier {
  public static get diName(): string {
    return "MediaQualifier"
  }

  public build(usage: IQualifierUsage): StyleFragment {
    return mediaFragment(usage)
  }
}
