// A path's readable slug: lowercase segments joined by single dashes, so it
// never starts with a dash nor contains two in a row - the reserved namespaces
// of variable names rely on both.
export function variableSlug(path: string): string {
  return path
    .replace(/[.:]+/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}
