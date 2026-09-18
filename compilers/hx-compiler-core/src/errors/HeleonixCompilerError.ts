import { IErrorInfo } from "./IErrorInfo"

export class HeleonixCompilerError extends Error {
  public readonly code: string

  public offset?: number

  public constructor(error: IErrorInfo, ...args: string[]) {
    const formattedMsg = HeleonixCompilerError.formatMessage(error.message, ...args)

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
