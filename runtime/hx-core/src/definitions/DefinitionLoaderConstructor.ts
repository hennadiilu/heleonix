import type { IDimensionProvider } from "../dimensions/IDimensionProvider"
import type { DefinitionSelectionStrategy } from "./DefinitionSelectionStrategy"

export type DefinitionLoaderConstructor<TSource, TLoader> = new (
  dimensions: IDimensionProvider,
  sources: readonly TSource[],
  selectionStrategy?: DefinitionSelectionStrategy,
) => TLoader
