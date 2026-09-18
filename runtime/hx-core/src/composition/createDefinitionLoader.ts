import type { IDimensionProvider } from "../dimension/IDimensionProvider"
import type { IDefinitionSection } from "../IDefinitionSection"

export function createDefinitionLoader<TSource, TLoader>(
  section: IDefinitionSection<TSource, TLoader> | undefined,
  Default: NonNullable<IDefinitionSection<TSource, TLoader>["loader"]>,
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
