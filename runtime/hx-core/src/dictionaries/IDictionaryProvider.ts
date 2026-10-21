import type { FQDictionaryEntryName } from "@heleonix/hx-language"
import type { DataObject } from "../common/DataObject"

export interface IDictionaryProvider {
  get<TValues extends DataObject<TValues>>(
    fqEntryName: FQDictionaryEntryName,
    values?: TValues,
  ): Promise<string | undefined>
}
