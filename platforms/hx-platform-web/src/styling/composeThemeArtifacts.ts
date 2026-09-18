import type { IThemeDefinition } from "@heleonix/hx-language"
import { composeKeyframes } from "./composeKeyframes"
import { composeFontFace } from "./composeFontFace"
import { composeCounterStyle } from "./composeCounterStyle"

export function composeThemeArtifacts(
  theme: Pick<IThemeDefinition, "keyframes" | "fontFaces" | "counterStyles">,
): string {
  const artifacts: string[] = []

  for (const [name, frames] of Object.entries(theme.keyframes ?? {})) {
    artifacts.push(composeKeyframes(name, frames))
  }

  for (const descriptors of theme.fontFaces ?? []) {
    artifacts.push(composeFontFace(descriptors))
  }

  for (const [name, descriptors] of Object.entries(theme.counterStyles ?? {})) {
    artifacts.push(composeCounterStyle(name, descriptors))
  }

  return artifacts.join("\n")
}
