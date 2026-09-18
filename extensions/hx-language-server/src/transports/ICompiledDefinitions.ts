import {
  IComponentDefinition,
  IConfigDefinition,
  IDictionaryDefinition,
  IDocsEntry,
  IMetaDocument,
} from "@heleonix/hx-language"

export interface ICompiledDefinitions {
  components?: IComponentDefinition[]

  dictionaries?: IDictionaryDefinition[]

  configs?: IConfigDefinition[]

  docs?: IDocsEntry[]

  metas?: IMetaDocument[]
}
