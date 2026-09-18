import { IMetaDocument } from "@heleonix/hx-language"
import { IIndexContribution } from "../index/IIndexContribution"

export interface IDefinitionSource {
  readonly id: string

  load(): Promise<IIndexContribution>

  metas?(): readonly IMetaDocument[]
}
