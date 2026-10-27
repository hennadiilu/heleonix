import { interpolateValue } from "@heleonix/hx-platform-web"

export function renderThemeVariables(tokens: ReadonlyMap<string, string>): string {
  return [...tokens].map(([name, value]) => `--${name}: ${interpolateValue(value)}`).join("; ")
}
