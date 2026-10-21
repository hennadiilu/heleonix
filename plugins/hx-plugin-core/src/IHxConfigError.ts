/** Why a configuration failed to load. */
export interface IHxConfigError {
  /** The file at fault: a configuration, or a dimensions file it names. */
  file: string

  code: string

  message: string

  /** Where in the file, when known. */
  offset?: number
}
