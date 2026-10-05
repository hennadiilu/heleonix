import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { StateManager } from "../state/StateManager"
import type { IDimensionProvider } from "../dimensions/IDimensionProvider"
import type { IConverterContext } from "../converters/IConverterContext"
import type { ClearableCollection } from "./ClearableCollection"
import { BindingEvaluator } from "../bindings/BindingEvaluator"
import { ConfigProvider } from "../configs/ConfigProvider"
import { DictionaryProvider } from "../dictionaries/DictionaryProvider"
import { Binder } from "../bindings/Binder"
import { composeConverters } from "./composeConverters"
import { composeValueSources } from "./composeValueSources"

export function composeBindings(
  bootstrap: IApplicationBootstrap,
  deps: { dimensions: IDimensionProvider; state: StateManager; clearables: ClearableCollection },
): { binder: Binder; configs: ConfigProvider; dictionaries: DictionaryProvider; evaluator: BindingEvaluator } {
  const valueSources = composeValueSources(bootstrap, deps)

  const converters = composeConverters(bootstrap, { context: () => converterContext, clearables: deps.clearables })

  const evaluator = new BindingEvaluator(converters, valueSources)

  const configs = new ConfigProvider(evaluator)

  const dictionaries = new DictionaryProvider(evaluator)

  const converterContext: IConverterContext = { dictionaries, configs }

  const binder = deps.clearables.add(new Binder(deps.state, evaluator))

  return { binder, configs, dictionaries, evaluator }
}
