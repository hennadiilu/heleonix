import type { IQualifierUsage } from "@heleonix/hx-language"
import type { StyleFragment } from "./StyleFragment"

/**
 * The neutral fragment for a pseudo-class/element rule-key segment: the
 * PascalCase name, with a functional pseudo's positional argument kept
 * (`NthChild(2n)`). The platform maps it to CSS (`:hover`, `::before`,
 * `:nth-child(2n)`), deciding `:` vs `::` from its own pseudo-element set - one
 * builder serves both pseudo-classes and pseudo-elements.
 */
export function pseudoFragment(usage: IQualifierUsage): StyleFragment {
  return { pseudo: usage.positional !== undefined ? `${usage.name}(${usage.positional})` : usage.name }
}
