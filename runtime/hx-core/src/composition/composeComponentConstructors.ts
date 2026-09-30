import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { ApplicationRuntime } from "../platform/ApplicationRuntime"
import type { ComponentConstructor } from "../components/ComponentConstructor"
import { DeclarativeComponent } from "../components/DeclarativeComponent"
import { Content } from "../components/Content"
import { Children } from "../components/Children"
import { hxNameMap } from "./hxNameMap"

export function composeComponentConstructors(
  bootstrap: IApplicationBootstrap,
  deps: { runtime: ApplicationRuntime },
): Map<string, ComponentConstructor> {
  return hxNameMap<ComponentConstructor>(
    [DeclarativeComponent, Content, Children],
    deps.runtime.componentConstructors,
    bootstrap.components ?? [],
  )
}
