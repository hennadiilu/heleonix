import { CONFIG_ENTRY_SEPARATOR, FQConfigEntryName } from "@heleonix/hx-language"
import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"
import type { ConfigDefinitionProvider } from "./ConfigDefinitionProvider"

/**
 * Looks up a single config value from its dimension-selected definition. Shared
 * by the {@link ConfigProvider} read facade and the {@link BindingEvaluator}, so
 * the split of `Name.entry` and the definition lookup live in one place rather
 * than being duplicated by each config reader.
 */
export async function resolveConfigEntry(
  configDefinitionProvider: ConfigDefinitionProvider,
  entry: FQConfigEntryName,
): Promise<unknown> {
  const splitIndex = entry.lastIndexOf(CONFIG_ENTRY_SEPARATOR)
  const name = entry.slice(0, splitIndex)

  const definition = await configDefinitionProvider.getDefinition(name)

  if (!definition) {
    throw new HeleonixError(Errors.configDefinitionProviding, name)
  }

  return definition.entries[entry.slice(splitIndex + 1)]
}
