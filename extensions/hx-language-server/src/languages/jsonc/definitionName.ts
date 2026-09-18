export function definitionName(uri: string): string {
  const lastSlash = Math.max(uri.lastIndexOf("/"), uri.lastIndexOf("\\"))
  const file = lastSlash >= 0 ? uri.slice(lastSlash + 1) : uri

  return decodeURIComponent(file).split(".")[0]
}
