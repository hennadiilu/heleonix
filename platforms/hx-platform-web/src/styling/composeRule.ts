import type { IStyleRule } from "@heleonix/hx-core"
import { composeSelector } from "./composeSelector"
import { declarationsToCss } from "./declarationsToCss"

// The style manager writes resolved values - from state, dictionaries and
// configs - into a media condition. One that could escape the condition into the
// stylesheet (a brace, `;`, a comment, `</` closing a server-rendered `<style>`)
// or a source left unresolved turns the condition into `not all`: the rule never
// applies, and nothing reaches the sheet.
const UNSAFE_CONDITION = /[{};]|\/\*|\*\/|<\//

export function composeRule({ id, conditions, declarations }: IStyleRule): string {
  let rule = `${composeSelector(id, conditions)} { ${declarationsToCss(declarations)} }`

  for (const condition of conditions) {
    if ("environment" in condition) {
      rule = `@media ${UNSAFE_CONDITION.test(condition.environment) ? "not all" : condition.environment} { ${rule} }`
    }
  }

  return rule
}
