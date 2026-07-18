import { EXPRESSION_PATTERN } from "./EXPRESSION_PATTERN"

/**
 * Replaces every `{...}` occurrence in `template` with the value returned
 * by `parameterGetter`. The getter receives the full match including the
 * surrounding braces; consumers that need only the inner name can use
 * {@link extractParameters} first.
 */
export function interpolate(template: string, parameterGetter: (parameter: string) => unknown): string {
  return template.replace(new RegExp(EXPRESSION_PATTERN, "g"), (match) => String(parameterGetter(match)))
}
