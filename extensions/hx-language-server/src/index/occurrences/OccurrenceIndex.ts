import { pathToFileURL } from "node:url"
import { COMPONENT_NAME_SEGMENT_SEPARATOR } from "@heleonix/hx-language"
import { Location, Range } from "vscode-languageserver"
import { DefinitionIndex } from "../DefinitionIndex"
import { IFileOccurrences } from "./IFileOccurrences"
import { IRawOccurrence } from "./IRawOccurrence"
import { IResolvedOccurrence } from "./IResolvedOccurrence"
import { offsetToPosition } from "./offsetToPosition"
import { symbolKey } from "./symbolKey"

export class OccurrenceIndex {
  private readonly byKey = new Map<string, IResolvedOccurrence[]>()

  private readonly byPath = new Map<string, IResolvedOccurrence[]>()

  private readonly lineStartsByPath = new Map<string, readonly number[]>()

  public constructor(files: readonly IFileOccurrences[], index: DefinitionIndex) {
    for (const file of files) {
      this.lineStartsByPath.set(file.filePath, file.lineStarts)
      const resolved: IResolvedOccurrence[] = []

      for (const raw of file.raw) {
        for (const key of keysOf(raw, index)) {
          const occurrence: IResolvedOccurrence = {
            filePath: file.filePath,
            key,
            role: raw.role,
            start: raw.start,
            end: raw.end,
          }
          resolved.push(occurrence)
          push(this.byKey, key, occurrence)
        }
      }

      this.byPath.set(file.filePath, resolved)
    }
  }

  public definitionsAt(filePath: string, offset: number): Location[] {
    return this.locationsOf(this.keysAt(filePath, offset), (role) => role === "definition")
  }

  public referencesAt(filePath: string, offset: number, includeDeclaration: boolean): Location[] {
    return this.locationsOf(this.keysAt(filePath, offset), (role) => role === "reference" || includeDeclaration)
  }

  private keysAt(filePath: string, offset: number): Set<string> {
    const keys = new Set<string>()

    for (const occurrence of this.byPath.get(filePath) ?? []) {
      if (offset >= occurrence.start && offset <= occurrence.end) {
        keys.add(occurrence.key)
      }
    }

    return keys
  }

  private locationsOf(keys: Iterable<string>, accept: (role: IResolvedOccurrence["role"]) => boolean): Location[] {
    const locations: Location[] = []
    const seen = new Set<string>()

    for (const key of keys) {
      for (const occurrence of this.byKey.get(key) ?? []) {
        if (!accept(occurrence.role)) {
          continue
        }

        const location = this.toLocation(occurrence)
        const id = `${location.uri}#${occurrence.start}`

        if (!seen.has(id)) {
          seen.add(id)
          locations.push(location)
        }
      }
    }

    return locations
  }

  private toLocation(occurrence: IResolvedOccurrence): Location {
    const lineStarts = this.lineStartsByPath.get(occurrence.filePath) ?? [0]

    return {
      uri: pathToFileURL(occurrence.filePath).href,
      range: Range.create(offsetToPosition(lineStarts, occurrence.start), offsetToPosition(lineStarts, occurrence.end)),
    }
  }
}

function keysOf(raw: IRawOccurrence, index: DefinitionIndex): string[] {
  switch (raw.kind) {
    case "component":
      return [symbolKey.component(raw.name)]

    case "dictionaryEntry":
      return [symbolKey.entry("dictionary", raw.name, raw.entry)]

    case "configEntry":
      return [symbolKey.entry("config", raw.name, raw.entry)]

    case "property": {
      const components =
        raw.base.source === "components"
          ? raw.base.components
          : index.entryReferrers("dictionary", raw.base.name, raw.base.entry)

      const targets = raw.prefix
        ? index.resolveControlChain(components, raw.prefix.split(COMPONENT_NAME_SEGMENT_SEPARATOR).filter(Boolean))
        : new Set(components)

      return [...targets].map((component) => symbolKey.property(component, raw.head))
    }
  }
}

function push(map: Map<string, IResolvedOccurrence[]>, key: string, occurrence: IResolvedOccurrence): void {
  const list = map.get(key)

  if (list) {
    list.push(occurrence)
  } else {
    map.set(key, [occurrence])
  }
}
