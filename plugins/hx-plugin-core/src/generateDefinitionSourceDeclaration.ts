import type { Kind } from "@heleonix/hx-language"
import { DEFINITION_INTERFACE_NAME } from "./definitionInterfaceName"

export function generateDefinitionSourceDeclaration(kind: Kind, className: string): string {
  const definition = DEFINITION_INTERFACE_NAME[kind]

  return `import { DefinitionSource } from "@heleonix/hx-core"
import type { ${definition} } from "@heleonix/hx-language"

export declare class ${className} extends DefinitionSource<${definition}> {}
`
}
