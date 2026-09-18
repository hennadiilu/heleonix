import type { Kind } from "@heleonix/hx-language"
import { DEFINITION_INTERFACE_NAME } from "./definitionInterfaceName"
import { DEFINITION_SOURCE_BASE_CLASS } from "./definitionSourceBaseClass"

export function generateDefinitionSourceDeclaration(kind: Kind, className: string): string {
  const baseClass = DEFINITION_SOURCE_BASE_CLASS[kind]
  const definition = DEFINITION_INTERFACE_NAME[kind]

  return `import { ${baseClass} } from "@heleonix/hx-core"
import type { ${definition} } from "@heleonix/hx-language"

export declare class ${className} extends ${baseClass}<${definition}> {}
`
}
