import { EXPRESSION_PATTERN } from "./EXPRESSION_PATTERN"

function stripDelimiters(this: void, match: string): string {
  return match.slice(1, -1)
}

/**
 * Returns the inner names of every `{name}` occurrence in `template`,
 * stripped of their delimiters.
 */
export function extractParameters(template: string): string[] {
  const matches = template.match(new RegExp(EXPRESSION_PATTERN, "g"))

  return matches ? matches.map(stripDelimiters) : []
}
