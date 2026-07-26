import { parseDocComment } from "@heleonix/hx-language"
import type { IDocs } from "@heleonix/hx-language"
import type { IComponentInfo, IMemberType } from "@heleonix/hx-analyzer"

/** Indexes the analyzer's component contracts by tag name for O(1) lookup. */
export function byName(components: readonly IComponentInfo[]): Map<string, IComponentInfo> {
  return new Map(components.map((info) => [info.name, info]))
}

/** The member (prop/event) named `member` on tag `tag`, or undefined. */
export function memberOf(index: Map<string, IComponentInfo>, tag: string, member: string): IMemberType | undefined {
  return index.get(tag)?.members.find((entry) => entry.name === member)
}

/** A component's summary text (parsed from its raw doc comment), or undefined. */
export function componentSummary(info: IComponentInfo | undefined): string | undefined {
  return info?.docs ? parseDocComment(info.docs)?.summary : undefined
}

/** A component's structured docs (parsed from its raw doc comment), or undefined. */
export function componentDocs(info: IComponentInfo | undefined): IDocs | undefined {
  return info?.docs ? parseDocComment(info.docs) : undefined
}

/**
 * A member's summary text. Member docs are plain prose (as TypeScript's own doc
 * comments yield); a leading `*` decoration is tolerated defensively.
 */
export function memberSummary(member: IMemberType | undefined): string | undefined {
  const docs = member?.docs?.replace(/^\*\s*/, "").trim()

  return docs || undefined
}

/** A member's value type rendered for display (`'a' | 'b'` for enums, the kind otherwise). */
export function memberType(member: IMemberType): string {
  return member.kind === "enum" ? (member.enumValues ?? []).map((value) => `'${value}'`).join(" | ") : member.kind
}
