import { IErrorInfo } from "./IErrorInfo"

export class HeleonixPluginError extends Error {
  public readonly code: string

  public constructor(error: IErrorInfo, ...args: string[]) {
    const formattedMsg = HeleonixPluginError.formatMessage(error.message, ...args)

    super(formattedMsg)

    Object.setPrototypeOf(this, new.target.prototype)

    this.name = new.target.name

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
