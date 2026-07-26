import type ts from "typescript"

/**
 * The injected inputs `TypeResolver` needs to build a TypeScript program,
 * supplied by a host so the resolver itself stays filesystem-free: a Node host
 * reads them from disk, a browser host (StackBlitz, etc.) serves them from an
 * in-memory virtual filesystem. `host` provides the source and lib files;
 * `rootFiles` are the project's own files (so ambient/global types resolve);
 * `options` are the resolved compiler options.
 */
export interface ITypeProgramHost {
  options: ts.CompilerOptions

  rootFiles: readonly string[]

  host: ts.CompilerHost
}
