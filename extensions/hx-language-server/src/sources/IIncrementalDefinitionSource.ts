import { IDefinitionSource } from "./IDefinitionSource"
import { IIndexContribution } from "../index/IIndexContribution"

export interface IIncrementalDefinitionSource extends IDefinitionSource {
  scanFiles(): Promise<Map<string, IIndexContribution>>

  handles(filePath: string): boolean

  indexFile(filePath: string, text?: string): Promise<IIndexContribution>
}
