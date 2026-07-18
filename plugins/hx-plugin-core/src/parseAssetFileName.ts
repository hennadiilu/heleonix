import path from "node:path"
import type { IDimension, IDimensionDefinition } from "@heleonix/hx-language"
import { AssetFileNameResult } from "./AssetFileNameResult"
import { HeleonixPluginError } from "./errors/HeleonixPluginError"
import { Errors } from "./errors/Errors"

export function parseAssetFileName(filePath: string, dimensions: readonly IDimensionDefinition[]): AssetFileNameResult {
  const ext = path.extname(filePath)
  const fileName = path.basename(filePath)
  const stem = path.basename(filePath, ext)
  const [name, ...segments] = stem.split(".")

  const dimension: IDimension = {}

  for (const segment of segments) {
    const matches = dimensions.filter((definition) => definition.values?.includes(segment))

    if (matches.length > 1) {
      throw new HeleonixPluginError(
        Errors.ambiguousDimensionValue,
        segment,
        fileName,
        matches.map((match) => match.name).join(", "),
      )
    }

    if (matches.length === 0) {
      // Value is outside this build's configured dimensions -> not a candidate.
      // Report the offending segment so callers can distinguish it from a real
      // parse and surface likely typos.
      return { skipped: true, unmatchedSegment: segment }
    }

    const owner = matches[0].name

    if (dimension[owner] !== undefined) {
      throw new HeleonixPluginError(Errors.duplicateDimension, owner, fileName)
    }

    dimension[owner] = segment
  }

  return { name, dimension, ext }
}
