import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IConverterContext } from "../converters/IConverterContext"
import type { Clearables } from "./Clearables"
import { ConverterProvider } from "../converters/ConverterProvider"
import { hxNameMap } from "./hxNameMap"

export function composeConverters(
  bootstrap: IApplicationBootstrap,
  context: () => IConverterContext,
  clearables: Clearables,
): ConverterProvider {
  return clearables.add(new ConverterProvider(hxNameMap(bootstrap.converters ?? []), context))
}
