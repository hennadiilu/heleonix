import type { FQComponentName, FQDictionaryEntryName } from "@heleonix/hx-language"

export interface IDictionaryProvider {
  get(path: FQDictionaryEntryName, scopeFQ: FQComponentName): Promise<string | undefined>
}
