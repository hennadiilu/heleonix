import { mangleVariable } from "@heleonix/hx-platform-web"

/**
 * Serializes resolved theme tokens into the inline-style declaration string set
 * on the app root at render time - the server-side analogue of the web adapter's
 * `applyThemeTokens`. Each token path is mangled to the same `--hx-` custom
 * property the composed classes reference (via the web's {@link mangleVariable}),
 * so the published variables match. Theme `@`-artifacts are emitted separately
 * through the web's `composeThemeArtifacts` into the document's `<style>`.
 */
export function renderThemeVariables(tokens: ReadonlyMap<string, string>): string {
  return [...tokens].map(([path, value]) => `${mangleVariable(path)}: ${value}`).join("; ")
}
