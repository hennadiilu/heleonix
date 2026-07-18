import type { Kind } from "@heleonix/hx-language"
import { DEFINITION_SOURCE_BASE_CLASS } from "./definitionSourceBaseClass"

/**
 * Generates the sibling `.d.ts` for an emitted definition-source module produced by
 * {@link generateDefinitionSource}, typing the exported class for TypeScript consumers.
 * Everything else (`getDefinitions`, ...) is inherited from the base class type.
 */
export function generateDefinitionSourceDeclaration(kind: Kind, className: string): string {
  const baseClass = DEFINITION_SOURCE_BASE_CLASS[kind]

  return `import { ${baseClass} } from "@heleonix/hx-core"

export declare class ${className} extends ${baseClass} {
  static get diName(): string
}
`
}
