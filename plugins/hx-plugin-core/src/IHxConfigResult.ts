import type { IHxConfig } from "./IHxConfig"
import type { IHxConfigError } from "./IHxConfigError"

/** What looking up a directory's configuration found, with what a host watches to know when to look again. */
export interface IHxConfigResult {
  /** The configuration governing the directory; absent when there is none, or it failed to load. */
  config?: IHxConfig

  /** Every file read - the configurations and the dimensions files they name - to watch for changes. */
  files: string[]

  /** Where a configuration was looked for in vain - to watch for one appearing. */
  missing: string[]

  error?: IHxConfigError
}
