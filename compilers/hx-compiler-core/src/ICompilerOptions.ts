export interface ICompilerOptions {
  /**
   * Logical name of the compiled artifact (usually derived from the source file name).
   *
   * Plugins (rollup/esbuild/vite/webpack) pass the file basename without extension
   * and dimension suffixes. Defaults to an empty string when omitted.
   */
  name?: string
}
