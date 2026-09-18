import type { IState } from "../state/IState"
import type { IConfigProvider } from "../configs/IConfigProvider"
import type { IDictionaryProvider } from "../dictionaries/IDictionaryProvider"
import type { IBinder } from "../bindings/IBinder"
import type { IComponentManager } from "./IComponentManager"
import type { IScheduler } from "../platform/IScheduler"
import type { IActionProvider } from "../actions/IActionProvider"

export interface IComponentContext {
  readonly state: IState

  readonly configs: IConfigProvider

  readonly dictionaries: IDictionaryProvider

  readonly binder: IBinder

  readonly components: IComponentManager

  readonly scheduler: IScheduler

  readonly actions: IActionProvider
}
