import type { IPackageNode } from "./IPackageNode"

/** What a file can see: the package owning it and everything that package depends on, transitively. */
export interface IPackageScope {
  /** The owning package's directory; empty for the whole workspace (a file no package owns). */
  readonly key: string

  /** The owning package first, then its dependencies. */
  readonly packages: readonly IPackageNode[]

  /** Whether a file belongs to one of the scope's packages. */
  contains(filePath: string): boolean
}
