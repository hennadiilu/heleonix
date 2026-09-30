import type { DefinitionSelectionStrategy } from "./definitions/DefinitionSelectionStrategy"
import type { DefinitionLoaderConstructor } from "./definitions/DefinitionLoaderConstructor"
import type { DefinitionSourceConstructor } from "./definitions/DefinitionSourceConstructor"

export interface IDefinitionSection<TSource, TLoader> {
  loader?: DefinitionLoaderConstructor<TSource, TLoader>

  sources: DefinitionSourceConstructor<TSource>[]

  selectionStrategy?: DefinitionSelectionStrategy
}
