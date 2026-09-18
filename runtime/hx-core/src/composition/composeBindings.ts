import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { StateManager } from "../state/StateManager"
import type { IDimensionProvider } from "../dimension/IDimensionProvider"
import type { IConverterContext } from "../converters/IConverterContext"
import type { Clearables } from "./Clearables"
import { BindingEvaluator } from "../bindings/BindingEvaluator"
import { ConfigProvider } from "../configs/ConfigProvider"
import { DictionaryProvider } from "../dictionaries/DictionaryProvider"
import { Binder } from "../bindings/Binder"
import { composeConverters } from "./composeConverters"
import { composeValueSources } from "./composeValueSources"

export function composeBindings(
  bootstrap: IApplicationBootstrap,
  deps: { dimensions: IDimensionProvider; state: StateManager },
  clearables: Clearables,
): { binder: Binder; configs: ConfigProvider; dictionaries: DictionaryProvider } {
  const valueSources = composeValueSources(bootstrap, deps, clearables)

  const converters = composeConverters(bootstrap, () => converterContext, clearables)

  const evaluator = new BindingEvaluator(converters, valueSources)

  const configs = new ConfigProvider(evaluator)

  const dictionaries = new DictionaryProvider(evaluator)

  const converterContext: IConverterContext = { dictionaries, configs }

  const binder = clearables.add(new Binder(deps.state, evaluator))

  return { binder, configs, dictionaries }
}
