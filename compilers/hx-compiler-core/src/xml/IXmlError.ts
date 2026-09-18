import { IErrorInfo } from "../errors/IErrorInfo"

export interface IXmlError {
  info: IErrorInfo

  args: string[]

  offset: number
}
