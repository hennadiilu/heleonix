import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IState } from "../state/IState"
import type { IStyleQualifier } from "../styling/qualifiers/IStyleQualifier"
import type { IStyleQualifierContext } from "../styling/qualifiers/IStyleQualifierContext"
import { QualifierProvider } from "../styling/qualifiers/QualifierProvider"
import { PseudoQualifier } from "../styling/qualifiers/PseudoQualifier"
import { MediaQualifier } from "../styling/qualifiers/MediaQualifier"
import { IfQualifier } from "../styling/qualifiers/IfQualifier"
import { hxNameMap } from "./hxNameMap"

export function composeQualifiers(bootstrap: IApplicationBootstrap, deps: { state: IState }): QualifierProvider {
  const context: IStyleQualifierContext = { state: deps.state }

  const byName = new Map<string, IStyleQualifier>([
    [MediaQualifier.hxName, new MediaQualifier(context)],
    [IfQualifier.hxName, new IfQualifier(context)],
  ])

  for (const [name, Qualifier] of hxNameMap(bootstrap.qualifiers ?? [])) {
    byName.set(name, new Qualifier(context))
  }

  return new QualifierProvider(byName, new PseudoQualifier(context))
}
