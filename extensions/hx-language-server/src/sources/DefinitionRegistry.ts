import { IMetaDocument } from "@heleonix/hx-language"
import { OccurrenceIndex } from "../index/occurrences/OccurrenceIndex"
import { DefinitionIndex } from "../index/DefinitionIndex"
import { IDefinitionSource } from "./IDefinitionSource"
import { IIncrementalDefinitionSource } from "./IIncrementalDefinitionSource"
import { IIndexContribution } from "../index/IIndexContribution"

export class DefinitionRegistry {
  private readonly sources: IDefinitionSource[] = []

  private readonly fileContributions = new Map<string, IIndexContribution>()

  private readonly sourceContributions = new Map<string, IIndexContribution>()

  private index = new DefinitionIndex([])

  private occurrences = new OccurrenceIndex([], this.index)

  public register(source: IDefinitionSource): void {
    this.sources.push(source)
  }

  public getIndex(): DefinitionIndex {
    return this.index
  }

  public metas(): IMetaDocument[] {
    const result: IMetaDocument[] = []

    for (const source of this.sources) {
      if (source.metas) {
        result.push(...source.metas())
      }
    }

    return result
  }

  public getOccurrences(): OccurrenceIndex {
    return this.occurrences
  }

  public async rebuild(): Promise<DefinitionIndex> {
    this.fileContributions.clear()
    this.sourceContributions.clear()

    for (const source of this.sources) {
      try {
        if (isIncremental(source)) {
          for (const [filePath, contribution] of await source.scanFiles()) {
            this.fileContributions.set(filePath, contribution)
          }
        } else {
          this.sourceContributions.set(source.id, await source.load())
        }
      } catch (error) {
        // A failing source must not take down the whole index.
        console.error(`[hx] definition source '${source.id}' failed:`, error)
      }
    }

    return this.reindex()
  }

  public async reloadSources(): Promise<DefinitionIndex> {
    this.sourceContributions.clear()

    for (const source of this.sources) {
      if (isIncremental(source)) {
        continue
      }

      try {
        this.sourceContributions.set(source.id, await source.load())
      } catch (error) {
        console.error(`[hx] definition source '${source.id}' failed:`, error)
      }
    }

    return this.reindex()
  }

  public async updateFile(filePath: string, text?: string): Promise<DefinitionIndex> {
    const source = this.sources.find(
      (candidate): candidate is IIncrementalDefinitionSource => isIncremental(candidate) && candidate.handles(filePath),
    )

    if (!source) {
      return this.index
    }

    try {
      this.fileContributions.set(filePath, await source.indexFile(filePath, text))
      return this.reindex()
    } catch (error) {
      console.error(`[hx] failed to index '${filePath}':`, error)
      return this.index
    }
  }

  public removeFile(filePath: string): DefinitionIndex {
    return this.fileContributions.delete(filePath) ? this.reindex() : this.index
  }

  private reindex(): DefinitionIndex {
    this.index = new DefinitionIndex([...this.sourceContributions.values(), ...this.fileContributions.values()])

    const files = []

    for (const contribution of this.fileContributions.values()) {
      if (contribution.occurrences) {
        files.push(contribution.occurrences)
      }
    }

    this.occurrences = new OccurrenceIndex(files, this.index)

    return this.index
  }
}

function isIncremental(source: IDefinitionSource): source is IIncrementalDefinitionSource {
  return typeof (source as IIncrementalDefinitionSource).scanFiles === "function"
}
