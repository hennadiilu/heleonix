import { variableSlug } from "../styling/variableSlug"

/**
 * The name a theme publishes a token under: `hx-<path>`, the one readable namespace no per-instance variable shares.
 */
export function themeVariableName(path: string): string {
  return `hx-${variableSlug(path)}`
}
