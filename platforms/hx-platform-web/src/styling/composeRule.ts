import type { StyleFragment } from "@heleonix/hx-core"
import { composeSelector } from "./composeSelector"
import { declarationsToCss } from "./declarationsToCss"
import { interpolateValue } from "./interpolateValue"

/**
 * Composes a full CSS rule for one signature: the {@link composeSelector}
 * selector, a declaration body with values interpolated to `var()`/`calc()`
 * chains, wrapped in an `@media` at-rule for each `environment` fragment (whose
 * query is itself interpolated, so `{$Breakpoints.mobile}` resolves).
 */
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
