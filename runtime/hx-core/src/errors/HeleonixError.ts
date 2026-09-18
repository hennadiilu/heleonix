import { IErrorInfo } from "./IErrorInfo"

export class HeleonixError extends Error {
  public static readonly hxName = "HeleonixError"

  public readonly code: string

  public constructor(error: IErrorInfo, ...args: string[]) {
    const formattedMsg = HeleonixError.formatMessage(error.message, ...args)

    super(formattedMsg)

    Object.setPrototypeOf(this, HeleonixError.prototype)

    // Declared, never derived from the class identifier: a minified build
    // would otherwise report a mangled name.
    this.name = (new.target as { hxName?: string }).hxName ?? HeleonixError.hxName

    this.code = error.code
  }

  private static formatMessage(formatString?: string, ...args: string[]): string | undefined {
    let result = formatString

    function replaceArg(value: string, index: number) {
      result = result?.replaceAll(`{${index}}`, value)
    }

    args.forEach(replaceArg)

    return result
  }
}
