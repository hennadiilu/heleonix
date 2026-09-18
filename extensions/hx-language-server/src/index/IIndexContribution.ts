import { IDocs, ReferenceType } from "@heleonix/hx-language"
import { IFileOccurrences } from "./occurrences/IFileOccurrences"

export interface IIndexContribution {
  components: string[]

  tagProperties: Record<string, string[]>

  usedTags: Record<string, string[]>

  references: Record<ReferenceType, Record<string, string[]>>

  entryReferrers: Record<ReferenceType, Record<string, string[]>>

  componentState: Record<string, string[]>

  entryParameters: Record<string, string[]>

  namedControls: Record<string, string[]>

  componentDocs: Record<string, IDocs>

  entryDocs: Record<ReferenceType, Record<string, IDocs>>

  occurrences?: IFileOccurrences
}
