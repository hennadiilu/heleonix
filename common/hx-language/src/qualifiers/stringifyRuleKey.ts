import type { IQualifierUsage } from "./IQualifierUsage"
import { RULE_KEY_SEPARATOR } from "./RULE_KEY_SEPARATOR"
import { stringifyQualifierUsage } from "./stringifyQualifierUsage"

export function stringifyRuleKey(usages: readonly IQualifierUsage[]): string {
  return usages.map(stringifyQualifierUsage).join(RULE_KEY_SEPARATOR)
}
