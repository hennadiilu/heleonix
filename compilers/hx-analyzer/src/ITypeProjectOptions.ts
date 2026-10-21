export interface ITypeProjectOptions {
  /**
   * `tsconfig` files or glob patterns, relative to each root, naming the projects to read; each project's
   * references are followed. When none is given or none matches, a root's nearest `tsconfig.json` (searched
   * upward) is its project.
   */
  projects?: readonly string[]

  /** Glob patterns of source files left out of every project, relative to the root holding them. */
  exclude?: readonly string[]

  /** Directory names never searched for projects. */
  excludeDirs?: ReadonlySet<string>
}
