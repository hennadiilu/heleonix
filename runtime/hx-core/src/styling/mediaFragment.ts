import type { IQualifierUsage } from "@heleonix/hx-language"
import type { StyleFragment } from "./StyleFragment"

/**
 * The neutral fragment for a `Media(query:...)` rule-key segment: the canonical
 * query text, kept as an `environment` payload the platform wraps in `@media`
 * (interpolating any `{$token}` in the query).
 */
export function mediaFragment(usage: IQualifierUsage): StyleFragment {
  return { environment: usage.args["query"] ?? "" }
}
