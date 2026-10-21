import { NodeTypeProjects } from "@heleonix/hx-analyzer"
import type { ITypeProgramHost } from "@heleonix/hx-analyzer"
import type { IHxBuildSettings } from "./IHxBuildSettings"

/**
 * A package's own TypeScript projects - its `tsconfig` and those it references - which back both validation and
 * the classes its `hx.meta.json` describes. Dependencies are read through their manifests, so a package's meta
 * never claims their classes.
 */
export function packageTypeHosts(
  context: string,
  settings: Pick<IHxBuildSettings, "typescriptExclude">,
): ITypeProgramHost[] {
  const exclude = settings.typescriptExclude

  return new NodeTypeProjects({ roots: [exclude?.base ?? context], exclude: exclude?.patterns }).fallbackOf(context)
}
