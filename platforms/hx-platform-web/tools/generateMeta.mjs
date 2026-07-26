// Generates hx.meta.json describing native HTML elements as components, from
// the pinned @vscode/web-custom-data devDependency. The generated artifact
// ships; the source data does not. Regenerate by bumping the dependency and
// rebuilding - the committed output makes upgrades reviewable diffs.
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const data = require("@vscode/web-custom-data/data/browsers.html-data.json")

const valueSets = new Map(data.valueSets.map((set) => [set.name, set.values.map((value) => value.name)]))

const components = [...data.tags]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((tag) => {
    // Native elements are open: they accept any attribute (`class`, `data-*`,
    // `aria-*`, ...), so unknown attributes are allowed - only the enumerated
    // ones below carry a value contract.
    const entry = { name: tag.name, dimension: {}, open: true }
    const summary = summarize(tag.description)

    // Component docs follow the parseable doc-comment convention (`* ...`, so
    // `@`-tags survive); member docs are plain prose, matching what the analyzer
    // reads from TypeScript's own doc comments for workspace component props.
    if (summary) {
      entry.docs = `* ${summary} `
    }

    const props = []

    for (const attribute of [...(tag.attributes ?? [])].sort((a, b) => a.name.localeCompare(b.name))) {
      const member = memberOf(attribute)
      const attributeDocs = summarize(attribute.description)

      if (attributeDocs) {
        member.docs = attributeDocs
      }

      props.push(member)
    }

    if (props.length > 0) {
      entry.props = props
    }

    return entry
  })

// Every native attribute is offered and documented. Boolean and enumerated
// (value-set) attributes carry a value contract; plain string-valued ones are
// `unknown` - a known attribute name with an unconstrained value (the type
// system has no open `string` type), so completion/hover know them while the
// value validator leaves them alone.
function memberOf(attribute) {
  if (attribute.valueSet === "v") {
    return { name: attribute.name, optional: true, kind: "boolean", isFunction: false }
  }

  const values = attribute.valueSet ? valueSets.get(attribute.valueSet) : undefined

  if (values && values.length > 0) {
    return { name: attribute.name, optional: true, kind: "enum", enumValues: values, isFunction: false }
  }

  return { name: attribute.name, optional: true, kind: "unknown", isFunction: false }
}

function summarize(description) {
  const text = typeof description === "string" ? description : description?.value

  if (!text) {
    return undefined
  }

  const first = text.split(/\n\n/)[0].replace(/\s+/g, " ").trim()

  return first.length > 240 ? `${first.slice(0, 237)}...` : first
}

const meta = {
  schemaVersion: 1,
  package: "@heleonix/hx-platform-web",
  components,
}

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../hx.meta.json")

fs.writeFileSync(out, `${JSON.stringify(meta, null, 2)}\n`)
console.log(`Generated ${out}: ${components.length} native elements.`)
