import type { StyleFragment } from "@heleonix/hx-core"
import { composeSelector } from "./composeSelector"
import { declarationsToCss } from "./declarationsToCss"
import { interpolateValue } from "./interpolateValue"

export function composeRule(
  className: string,
  fragments: readonly StyleFragment[],
  declarations: Readonly<Record<string, string>>,
): string {
  let rule = `${composeSelector(className, fragments)} { ${declarationsToCss(declarations)} }`

  for (const fragment of fragments) {
    if ("environment" in fragment) {
      rule = `@media ${interpolateValue(fragment.environment)} { ${rule} }`
    }
  }

  return rule
}
