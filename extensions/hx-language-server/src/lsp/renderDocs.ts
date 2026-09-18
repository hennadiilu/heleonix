import { IDocs } from "@heleonix/hx-language"

export function renderDocs(title: string, docs: IDocs): string {
  const parts: string[] = [`**\`${title}\`**`]

  if (docs.deprecated) {
    parts.push(`*Deprecated:* ${docs.deprecated}`)
  }

  if (docs.summary) {
    parts.push(docs.summary)
  }

  pushNames(parts, "Properties", docs.props)
  pushNames(parts, "Parameters", docs.params)

  for (const example of docs.examples ?? []) {
    parts.push("```\n" + example + "\n```")
  }

  if (docs.see?.length) {
    parts.push(`*See:* ${docs.see.join(", ")}`)
  }

  return parts.join("\n\n")
}

function pushNames(parts: string[], caption: string, names?: Record<string, string>): void {
  const keys = names ? Object.keys(names) : []

  if (keys.length > 0) {
    parts.push(`*${caption}:*\n` + keys.map((key) => `- \`${key}\`: ${names![key]}`).join("\n"))
  }
}
