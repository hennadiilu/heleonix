import { parseDocComment } from "@heleonix/hx-language"
import type { IDocs } from "@heleonix/hx-language"
import type { IComponentInfo, IMemberType } from "@heleonix/hx-analyzer"

export function byName(components: readonly IComponentInfo[]): Map<string, IComponentInfo> {
  return new Map(components.map((info) => [info.name, info]))
}

export function memberOf(index: Map<string, IComponentInfo>, tag: string, member: string): IMemberType | undefined {
  return index.get(tag)?.members.find((entry) => entry.name === member)
}

export function componentSummary(info: IComponentInfo | undefined): string | undefined {
  return info?.docs ? parseDocComment(info.docs)?.summary : undefined
}

export function componentDocs(info: IComponentInfo | undefined): IDocs | undefined {
  return info?.docs ? parseDocComment(info.docs) : undefined
}

export function memberSummary(member: IMemberType | undefined): string | undefined {
  const docs = member?.docs?.replace(/^\*\s*/, "").trim()

  return docs || undefined
}

export function memberType(member: IMemberType): string {
  return member.kind === "enum" ? (member.enumValues ?? []).map((value) => `'${value}'`).join(" | ") : member.kind
}
