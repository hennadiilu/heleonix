import { EXPRESSION_PATTERN } from "./EXPRESSION_PATTERN"

function stripDelimiters(this: void, match: string): string {
  return match.slice(1, -1)
}

export function extractParameters(template: string): string[] {
  const matches = template.match(new RegExp(EXPRESSION_PATTERN, "g"))

  return matches ? matches.map(stripDelimiters) : []
}
