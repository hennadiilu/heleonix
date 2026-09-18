export function mangleVariable(key: string): string {
  const slug = key
    .replace(/[.:]+/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return `--hx-${slug}`
}
