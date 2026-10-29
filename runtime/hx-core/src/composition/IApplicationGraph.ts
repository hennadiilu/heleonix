import type { IClearable } from "../common/IClearable"
import type { ApplicationRuntime } from "../platform/ApplicationRuntime"
import type { IScheduler } from "../platform/IScheduler"
import type { IDimensionManager } from "../dimensions/IDimensionManager"
import type { IState } from "../state/IState"
import type { IConfigProvider } from "../configs/IConfigProvider"
import type { IDictionaryProvider } from "../dictionaries/IDictionaryProvider"
import type { IActionProvider } from "../actions/IActionProvider"
import type { IServiceProvider } from "../services/IServiceProvider"
import type { IComponentManager } from "../components/IComponentManager"
import type { IComponentContext } from "../components/IComponentContext"
import type { ThemeManager } from "../theming/ThemeManager"
import type { StyleManager } from "../styling/StyleManager"

export interface IApplicationGraph {
  readonly runtime: ApplicationRuntime

  readonly scheduler: IScheduler

  readonly dimensions: IDimensionManager

  readonly state: IState

  readonly configs: IConfigProvider

  readonly dictionaries: IDictionaryProvider

  readonly actions: IActionProvider

  readonly services: IServiceProvider

  readonly components: IComponentManager

  readonly componentContext: IComponentContext

  readonly themes: ThemeManager | undefined

  readonly styles: StyleManager | undefined

  readonly isHeadless: boolean

  readonly clearables: readonly IClearable[]
}
