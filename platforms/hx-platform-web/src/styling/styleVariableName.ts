import type { IStyleVariable } from "@heleonix/hx-core"
import { hashClassName } from "./hashClassName"
import { mangleVariable } from "./mangleVariable"

const PROPERTY_PATH = /^[A-Za-z_][\w.:]*$/

const PREFIX_WORDS: Readonly<Record<string, string>> = { "@": "dict-", "#": "config-", $: "theme-" }

// A plain property path keeps its readable `--hx-<path>` name. Any other source
// lives under `--hx--`, which no property path can produce (a mangled path never
// starts with `-`), with a content hash keeping distinct sources apart.
export function styleVariableName(variable: IStyleVariable): string {
  if (!variable.text && PROPERTY_PATH.test(variable.source)) {
    return mangleVariable(variable.source)
  }

  const readable = variable.source
    .replace(/^[@#$]/, (prefix) => PREFIX_WORDS[prefix])
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
  const hash = hashClassName(`${variable.text ? "text" : "raw"} ${variable.source}`).replace(/^hx-/, "")

  return `--hx--${readable}${variable.text ? "-text" : ""}-${hash}`
}
