import type { StyleCondition } from "@heleonix/hx-core"

// CSS pseudo-elements (`::`), distinguished from pseudo-classes (`:`); a rule has
// at most one, always serialized last.
const PSEUDO_ELEMENTS = new Set([
  "before",
  "after",
  "first-line",
  "first-letter",
  "placeholder",
  "selection",
  "backdrop",
  "marker",
  "cue",
  "file-selector-button",
  "grammar-error",
  "spelling-error",
  "target-text",
])

export function composeSelector(className: string, conditions: readonly StyleCondition[]): string {
  let selector = `.${className}`
  let element = ""

  for (const condition of conditions) {
    if ("pseudo" in condition) {
      const css = pseudoToCss(condition.pseudo)

      if (css.startsWith("::")) {
        element = css
      } else {
        selector += css
      }
    } else if ("gate" in condition) {
      // The gate id is already an attribute-safe slug (from the qualifier), and
      // must match the `data-hx-<id>` the qualifier's `attach` toggles verbatim.
      selector += `[data-hx-${condition.gate}]`
    }
  }

  return selector + element
}

function pseudoToCss(pseudo: string): string {
  const open = pseudo.indexOf("(")
  const slug = kebab(open < 0 ? pseudo : pseudo.slice(0, open))
  const arg = open < 0 ? "" : pseudo.slice(open)

  return `${PSEUDO_ELEMENTS.has(slug) ? "::" : ":"}${slug}${arg}`
}

function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}
