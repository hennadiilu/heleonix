import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { Clearables } from "./Clearables"
import { ServiceProvider } from "../services/ServiceProvider"

export function composeServices(bootstrap: IApplicationBootstrap, clearables: Clearables): ServiceProvider {
  return clearables.add(new ServiceProvider(new Set(bootstrap.services ?? [])))
}
