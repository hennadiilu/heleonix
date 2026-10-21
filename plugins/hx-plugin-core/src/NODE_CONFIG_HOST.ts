import fs from "node:fs"
import { createRequire } from "node:module"
import type { IHxConfigHost } from "./IHxConfigHost"

export const NODE_CONFIG_HOST: IHxConfigHost = {
  readFile: (file) => {
    try {
      return fs.statSync(file).isFile() ? fs.readFileSync(file, "utf8") : undefined
    } catch {
      return undefined
    }
  },
  resolvePackage: (specifier, fromFile) => {
    try {
      return createRequire(fromFile).resolve(specifier)
    } catch {
      return undefined
    }
  },
}
