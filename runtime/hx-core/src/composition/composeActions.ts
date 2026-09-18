import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IActionContext } from "../actions/IActionContext"
import type { Clearables } from "./Clearables"
import { ActionProvider } from "../actions/ActionProvider"
import { hxNameMap } from "./hxNameMap"

export function composeActions(
  bootstrap: IApplicationBootstrap,
  context: IActionContext,
  clearables: Clearables,
): ActionProvider {
  return clearables.add(new ActionProvider(hxNameMap(bootstrap.actions ?? []), context))
}
