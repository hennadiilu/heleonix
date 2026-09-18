import type { IDimensionProvider } from "./dimension/IDimensionProvider"
import type { DefinitionSelectionStrategy } from "./definitions/DefinitionSelectionStrategy"

export interface IDefinitionSection<TSource, TLoader> {
  loader?: new (
    dimensions: IDimensionProvider,
    sources: readonly TSource[],
    selectionStrategy?: DefinitionSelectionStrategy,
  ) => TLoader

  sources: (new () => TSource)[]

  selectionStrategy?: DefinitionSelectionStrategy
}
