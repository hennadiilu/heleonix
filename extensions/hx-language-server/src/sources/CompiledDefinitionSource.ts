import { IMetaDocument } from "@heleonix/hx-language"
import { IDefinitionTransport } from "../transports/IDefinitionTransport"
import { IDefinitionSource } from "./IDefinitionSource"
import { IIndexContribution } from "../index/IIndexContribution"
import { projectCompiledDefinitions } from "./projectCompiledDefinitions"

export class CompiledDefinitionSource implements IDefinitionSource {
  public readonly id: string

  private lastMetas: readonly IMetaDocument[] = []

  public constructor(private readonly transport: IDefinitionTransport) {
    this.id = transport.id
  }

  public async load(): Promise<IIndexContribution> {
    const compiled = await this.transport.load()

    this.lastMetas = compiled.metas ?? []

    return projectCompiledDefinitions(compiled)
  }

  public metas(): readonly IMetaDocument[] {
    return this.lastMetas
  }
}
