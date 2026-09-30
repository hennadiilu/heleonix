import type { IDimensionProvider } from "../dimensions/IDimensionProvider"
import type { IDefinitionSection } from "../IDefinitionSection"
import type { DefinitionLoaderConstructor } from "../definitions/DefinitionLoaderConstructor"

export function createDefinitionLoader<TSource, TLoader>(
  section: IDefinitionSection<TSource, TLoader> | undefined,
  Default: DefinitionLoaderConstructor<TSource, TLoader>,
  dimensions: IDimensionProvider,
  builtinSources: readonly TSource[] = [],
): TLoader | undefined {
  if (!section) {
    return undefined
  }

  const Loader = section.loader ?? Default

  return new Loader(
    dimensions,
    [...builtinSources, ...section.sources.map((Source) => new Source())],
    section.selectionStrategy,
  )
}
