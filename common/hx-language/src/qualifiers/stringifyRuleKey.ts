import type { IQualifierUsage } from "./IQualifierUsage"
import { RULE_KEY_SEPARATOR } from "./RULE_KEY_SEPARATOR"
import { stringifyQualifierUsage } from "./stringifyQualifierUsage"

/**
 * Serializes qualifier segments back to a canonical rule key: each segment
 * canonicalized by {@link stringifyQualifierUsage} and `&`-joined in the given
 * order. The inverse of `parseRuleKey` on canonical input; an empty list yields
 * `""` (the root rule).
 */
export function stringifyRuleKey(usages: readonly IQualifierUsage[]): string {
  return usages.map(stringifyQualifierUsage).join(RULE_KEY_SEPARATOR)
}
