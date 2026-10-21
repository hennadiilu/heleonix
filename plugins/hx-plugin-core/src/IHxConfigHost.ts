/**
 * How configuration files are read - the file system by default (`NODE_CONFIG_HOST`); an editor passes one reading
 * its unsaved documents first, a bundler one reading through its own file system.
 */
export interface IHxConfigHost {
  /** A file's text; `undefined` when it does not exist (or is not a file). */
  readFile(file: string): string | undefined

  /** The file a package specifier names (`@acme/config/hx.config.json`), resolved from a file's location. */
  resolvePackage(specifier: string, fromFile: string): string | undefined
}
