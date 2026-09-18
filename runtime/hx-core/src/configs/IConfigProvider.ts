import type { FQConfigEntryName } from "@heleonix/hx-language"

export interface IConfigProvider {
  get(entry: FQConfigEntryName): Promise<unknown>
}
