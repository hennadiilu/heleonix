import { mangleVariable } from "@heleonix/hx-platform-web"

export function renderThemeVariables(tokens: ReadonlyMap<string, string>): string {
  return [...tokens].map(([path, value]) => `${mangleVariable(path)}: ${value}`).join("; ")
}
