import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { ClearableCollection } from "./ClearableCollection"
import { ServiceProvider } from "../services/ServiceProvider"

export function composeServices(
  bootstrap: IApplicationBootstrap,
  deps: { clearables: ClearableCollection },
): ServiceProvider {
  return deps.clearables.add(new ServiceProvider(new Set(bootstrap.services ?? [])))
}
