import type { FQConfigEntryName } from "@heleonix/hx-language"

export interface IConfigProvider {
  get(fqEntryName: FQConfigEntryName): Promise<unknown>
}
