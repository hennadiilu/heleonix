import fs from "node:fs"
import type { IBuildReport } from "./IBuildReport"
import type { IHxConfigResult } from "./IHxConfigResult"

/**
 * The build error of a configuration that failed to load - reported instead of thrown, so a watching build keeps
 * running (with the defaults) until the file is fixed.
 */
export function configReportOf(lookup: IHxConfigResult): IBuildReport | undefined {
  const error = lookup.error

  if (!error) {
    return undefined
  }

  let location = error.file

  if (error.offset !== undefined) {
    try {
      const before = fs.readFileSync(error.file, "utf8").slice(0, error.offset)

      location = `${error.file}:${before.split("\n").length}:${error.offset - before.lastIndexOf("\n")}`
    } catch {
      // The file vanished; its path alone still points the way.
    }
  }

  const prefix = `${error.code}: `

  return {
    level: "error",
    code: error.code,
    text: `${error.message.startsWith(prefix) ? "" : prefix}${error.message} (${location})`,
  }
}
