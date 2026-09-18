import { pathToFileURL } from "node:url"
import type { IComponentInfo } from "@heleonix/hx-analyzer"
import type { IXmlScan } from "@heleonix/hx-compiler-core"
import type { Location } from "vscode-languageserver"

export function definitionComponent(
  offset: number,
  scan: IXmlScan,
  components: readonly IComponentInfo[],
): Location | null {
  const registry = new Map(components.map((info) => [info.name, info]))

  for (const tag of scan.tags) {
    if (tag.closing || offset < tag.nameStart || offset > tag.nameEnd) {
      continue
    }

    const info = registry.get(tag.name)

    if (info?.file === undefined || info.line === undefined || info.character === undefined) {
      return null
    }

    const position = { line: info.line, character: info.character }

    return { uri: pathToFileURL(info.file).toString(), range: { start: position, end: position } }
  }

  return null
}
