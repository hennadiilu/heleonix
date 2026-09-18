import type ts from "typescript"

export interface ITypeProgramHost {
  options: ts.CompilerOptions

  rootFiles: readonly string[]

  host: ts.CompilerHost
}
