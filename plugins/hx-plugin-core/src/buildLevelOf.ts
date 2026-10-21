import type { DiagnosticLevel } from "./DiagnosticLevel"
import type { IHxBuildSettings } from "./IHxBuildSettings"

/**
 * How a build reports a diagnostic: its configured level, else its own. `error` fails the build, and so does
 * `warning` with `failOnWarnings`; `information` and `hint` belong to editors, `off` to nobody.
 */
export function buildLevelOf(
  code: string,
  own: DiagnosticLevel,
  settings: Pick<IHxBuildSettings, "severity" | "failOnWarnings">,
): "error" | "warning" | undefined {
  const level = settings.severity[code] ?? own

  if (level === "error" || (level === "warning" && settings.failOnWarnings)) {
    return "error"
  }

  return level === "warning" ? "warning" : undefined
}
