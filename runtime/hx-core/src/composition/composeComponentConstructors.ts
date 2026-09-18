import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { ApplicationRuntime } from "../platform/ApplicationRuntime"
import type { ComponentConstructor } from "../components/ComponentConstructor"
import { DeclarativeComponent } from "../components/DeclarativeComponent"
import { Content } from "../components/Content"
import { Children } from "../components/Children"
import { hxNameMap } from "./hxNameMap"

export function composeComponentConstructors(
  bootstrap: IApplicationBootstrap,
  runtime: ApplicationRuntime,
): Map<string, ComponentConstructor> {
  // Platform components before application ones: a component of the same name is
  // meant to replace what the platform provides, so the lists collide by design.
  return hxNameMap<ComponentConstructor>(
    [DeclarativeComponent, Content, Children],
    runtime.componentConstructors,
    bootstrap.components ?? [],
  )
}
