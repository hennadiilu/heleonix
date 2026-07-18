import type { FQDictionaryEntryName } from "@heleonix/hx-language"
import { FrameworkElement } from "../FrameworkElement"
import { DictionaryManager } from "./DictionaryManager"

export class DictionaryProvider extends FrameworkElement<DictionaryManager> {
  private readonly dictionaryManager = this.inject(DictionaryManager)

  public static get diName(): string {
    return "DictionaryProvider"
  }

  public getValue(path: FQDictionaryEntryName, parameterGetter: (raw: string) => unknown): Promise<string | undefined> {
    return this.dictionaryManager.getValue(path, parameterGetter)
  }
}
