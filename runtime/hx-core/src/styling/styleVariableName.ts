import { parseBindingExpression } from "@heleonix/hx-language"
import { themeVariableName } from "../theming/themeVariableName"
import { hashStyleKey } from "./hashStyleKey"
import { variableSlug } from "./variableSlug"

const PROPERTY_PATH = /^[A-Za-z_][\w.:]*$/

const PREFIX_WORDS: Readonly<Record<string, string>> = { "@": "dict-", "#": "config-", $: "theme-" }

/**
 * The name of the variable a binding source in a declaration value reads. An unquoted theme token reads the one its
 * theme publishes (`hx-<path>`); every other source reads a per-instance variable the style manager sets, all of which
 * live under `hx--`, a prefix no theme token can produce. There, a plain property path keeps its readable slug
 * (`hx--some-prop`), and any other source gets a readable part and a content hash separated by `--`, which no slug
 * contains. Platforms add their own syntax (`--` on the web).
 */
export function styleVariableName(source: string, text: boolean): string {
  if (!text) {
    const binding = parseBindingExpression(source)

    if (binding.type === "theme") {
      return themeVariableName(binding.value)
    }

    if (PROPERTY_PATH.test(source)) {
      return `hx--${variableSlug(source)}`
    }
  }

  const readable = source
    .replace(/^[@#$]/, (prefix) => PREFIX_WORDS[prefix])
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()

  return `hx--${readable}${text ? "-text" : ""}--${hashStyleKey(`${text ? "text" : "raw"} ${source}`)}`
}
