import type { StyleFragment } from "@heleonix/hx-core"
import { composeSelector } from "./composeSelector"
import { declarationsToCss } from "./declarationsToCss"

// The style manager writes resolved values - from state, dictionaries and
// configs - into a media condition. One that could escape the condition into the
// stylesheet (a brace, `;`, a comment, `</` closing a server-rendered `<style>`)
// or a source left unresolved turns the condition into `not all`: the rule never
// applies, and nothing reaches the sheet.
const UNSAFE_CONDITION = /[{};]|\/\*|\*\/|<\//

export function composeRule(
  className: string,
  fragments: readonly StyleFragment[],
  declarations: Readonly<Record<string, string>>,
): string {
  let rule = `${composeSelector(className, fragments)} { ${declarationsToCss(declarations)} }`

  for (const fragment of fragments) {
    if ("environment" in fragment) {
      rule = `@media ${UNSAFE_CONDITION.test(fragment.environment) ? "not all" : fragment.environment} { ${rule} }`
    }
  }

  return rule
}
