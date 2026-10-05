import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IStyleQualifier } from "../styling/qualifiers/IStyleQualifier"
import { QualifierProvider } from "../styling/qualifiers/QualifierProvider"
import { PseudoQualifier } from "../styling/qualifiers/PseudoQualifier"
import { MediaQualifier } from "../styling/qualifiers/MediaQualifier"
import { IfQualifier } from "../styling/qualifiers/IfQualifier"
import { hxNameMap } from "./hxNameMap"

export function composeQualifiers(bootstrap: IApplicationBootstrap): QualifierProvider {
  const byName = new Map<string, IStyleQualifier>([
    [MediaQualifier.hxName, new MediaQualifier()],
    [IfQualifier.hxName, new IfQualifier()],
  ])

  for (const [name, Qualifier] of hxNameMap(bootstrap.qualifiers ?? [])) {
    byName.set(name, new Qualifier())
  }

  return new QualifierProvider(byName, new PseudoQualifier())
}
