/**
 * Mangles a neutral key (a theme token path `Colors.Roles.Primary.bg` or a state
 * path `someProp` / `sub.subsub:isInvalid`) into its `--hx-` CSS custom property
 * name: dot/colon addressers and camelCase become kebab-case, lowercased.
 */
export function mangleVariable(key: string): string {
  const slug = key
    .replace(/[.:]+/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return `--hx-${slug}`
}
