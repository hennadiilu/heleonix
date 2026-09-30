import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IConverterContext } from "../converters/IConverterContext"
import type { ClearableCollection } from "./ClearableCollection"
import { ConverterProvider } from "../converters/ConverterProvider"
import { hxNameMap } from "./hxNameMap"

export function composeConverters(
  bootstrap: IApplicationBootstrap,
  deps: { context: () => IConverterContext; clearables: ClearableCollection },
): ConverterProvider {
  return deps.clearables.add(new ConverterProvider(hxNameMap(bootstrap.converters ?? []), deps.context))
}
