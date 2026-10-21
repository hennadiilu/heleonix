export interface IPackageNode {
  /** The package's directory (its real path when linked in from outside the workspace). */
  readonly dir: string

  readonly name?: string

  /** Linked in from outside the workspace folders: its TypeScript sources are read, its `.hx*` files are not. */
  readonly external: boolean
}
