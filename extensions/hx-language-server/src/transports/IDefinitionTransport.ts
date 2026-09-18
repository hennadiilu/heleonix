import { ICompiledDefinitions } from "./ICompiledDefinitions"

export interface IDefinitionTransport {
  readonly id: string

  load(): Promise<ICompiledDefinitions>
}
