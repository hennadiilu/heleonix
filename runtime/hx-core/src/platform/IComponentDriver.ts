import type { PlatformComponent } from "../components/PlatformComponent"
import type { IComponentContext } from "../components/IComponentContext"

export interface IComponentDriver {
  getRootHost(selector: string, context: IComponentContext): PlatformComponent | null
}
