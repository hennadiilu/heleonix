import { EXPRESSION_PATTERN } from "./EXPRESSION_PATTERN"

export function interpolate(template: string, parameterGetter: (parameter: string) => unknown): string {
  return template.replace(new RegExp(EXPRESSION_PATTERN, "g"), (match) => String(parameterGetter(match)))
}
