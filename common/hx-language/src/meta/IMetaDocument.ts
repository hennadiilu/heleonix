import type { IComponentMetaEntry } from "./IComponentMetaEntry"
import type { IConverterActionMetaEntry } from "./IConverterActionMetaEntry"
import type { IDocsEntry } from "../docs/IDocsEntry"
import type { IQualifierDefinition } from "../qualifiers/IQualifierDefinition"

export interface IMetaDocument {
  schemaVersion: number

  package?: string

  version?: string

  docs?: IDocsEntry[]

  components?: IComponentMetaEntry[]

  converters?: IConverterActionMetaEntry[]

  actions?: IConverterActionMetaEntry[]

  themeTokens?: Record<string, string>

  qualifiers?: IQualifierDefinition[]
}
