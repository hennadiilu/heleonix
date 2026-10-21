import type ts from "typescript"

export interface ITypeProgramHost {
  options: ts.CompilerOptions

  rootFiles: readonly string[]

  host: ts.CompilerHost

  /** The directory of the project's `tsconfig.json` (the folder it serves when there is none). */
  projectDir: string
}
