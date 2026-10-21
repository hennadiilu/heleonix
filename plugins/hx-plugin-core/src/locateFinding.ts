import fs from "node:fs"

/** Where a finding's subject first appears in its file, as `file:line:column` (the file alone when unknown). */
export function locateFinding(file: string, subject: string | undefined): string {
  if (!subject) {
    return file
  }

  let text: string

  try {
    text = fs.readFileSync(file, "utf8")
  } catch {
    return file
  }

  const offset = text.indexOf(subject)

  if (offset === -1) {
    return file
  }

  const before = text.slice(0, offset)
  const line = before.split("\n").length
  const column = offset - before.lastIndexOf("\n")

  return `${file}:${line}:${column}`
}
