import { interpolateValue } from "./interpolateValue"
import { vendorPrefixes } from "./vendorPrefixes"

/**
 * Serializes a declaration group to CSS, interpolating each value to var()/calc()
 * chains and emitting any {@link vendorPrefixes} alias ahead of the standard
 * property (so `-webkit-` fallbacks precede the spec name).
 */
export function declarationsToCss(declarations: Readonly<Record<string, string>>): string {
  const parts: string[] = []

  for (const [property, value] of Object.entries(declarations)) {
    const interpolated = interpolateValue(value)

    for (const prefixed of vendorPrefixes(property)) {
      parts.push(`${prefixed}: ${interpolated};`)
    }

    parts.push(`${property}: ${interpolated};`)
  }

  return parts.join(" ")
}
