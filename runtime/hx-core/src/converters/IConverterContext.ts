import type { IDictionaryProvider } from "../dictionaries/IDictionaryProvider"
import type { IConfigProvider } from "../configs/IConfigProvider"

export interface IConverterContext {
  readonly dictionaries: IDictionaryProvider

  readonly configs: IConfigProvider
}
