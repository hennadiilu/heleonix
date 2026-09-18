import { promises as fsp } from "node:fs"
import path from "node:path"
import { IDefinitionTransport } from "./IDefinitionTransport"
import { ICompiledDefinitions } from "./ICompiledDefinitions"
import { mergeCompiledDefinitions, normalizeCompiledDefinitions } from "./normalizeCompiledDefinitions"

export class FileDefinitionTransport implements IDefinitionTransport {
  public readonly id: string

  public constructor(private readonly absolutePath: string) {
    this.id = `file:${absolutePath}`
  }

  public async load(): Promise<ICompiledDefinitions> {
    const stat = await fsp.stat(this.absolutePath)

    if (!stat.isDirectory()) {
      return normalizeCompiledDefinitions(await readJson(this.absolutePath))
    }

    const merged = normalizeCompiledDefinitions(undefined)

    for await (const match of fsp.glob("*.json", { cwd: this.absolutePath })) {
      mergeCompiledDefinitions(
        merged,
        normalizeCompiledDefinitions(await readJson(path.resolve(this.absolutePath, match))),
      )
    }

    return merged
  }
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await fsp.readFile(filePath, "utf8"))
}
