import { IErrorInfo } from "./IErrorInfo"

export class HeleonixError extends Error {
  public readonly code: string

  public constructor(error: IErrorInfo, ...args: string[]) {
    const formattedMsg = HeleonixError.formatMessage(error.message, ...args)

    super(formattedMsg)

    Object.setPrototypeOf(this, HeleonixError.prototype)

    this.name = this.constructor.name

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
