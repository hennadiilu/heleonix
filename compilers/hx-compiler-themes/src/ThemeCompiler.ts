import {
  XmlCompiler,
  ICompilerOptions,
  IXmlElement,
  IXmlScan,
  xmlEntryDocs,
  xmlRootDocs,
} from "@heleonix/hx-compiler-core"
import type { IDimension, DimensionUsage, IDocs, Kind } from "@heleonix/hx-language"
import type { IThemeDefinition, IThemeNode } from "@heleonix/hx-language"

const ROOT_TAG = "Theme"

export class ThemeCompiler extends XmlCompiler<IThemeDefinition> {
  protected get rootTag(): string {
    return ROOT_TAG
  }

  protected get kind(): Kind {
    return "theme"
  }

  /** Themes are documented per design token: inline doc comments above tokens become `entries` keyed by token path. */
  protected override extractDocs(scan: IXmlScan, source: string): IDocs | undefined {
    const docs: IDocs = { ...xmlRootDocs(scan, source, ROOT_TAG) }
    const entries = xmlEntryDocs(scan, source)

    if (entries) {
      docs.entries = entries
    }

    return Object.keys(docs).length > 0 ? docs : undefined
  }

  protected compileElement(root: IXmlElement, dimension: IDimension, options: ICompilerOptions): IThemeDefinition {
    return {
      name: options.name ?? "",
      dimension,
      usage: normalizeUsage(root.attributes["usage"]),
      groups: collectGroups(root),
    }
  }
}

function normalizeUsage(raw: string | undefined): DimensionUsage | undefined {
  if (raw === "extend") {
    return "extend"
  } else if (raw === "override") {
    return "override"
  }

  return undefined
}

function collectGroups(element: IXmlElement): Record<string, IThemeNode> {
  const groups: Record<string, IThemeNode> = {}

  for (const child of element.children) {
    if (child.type !== "element") {
      continue
    }

    groups[child.tag] = toNode(child)
  }

  return groups
}

function toNode(element: IXmlElement): IThemeNode {
  const node: IThemeNode = { attributes: element.attributes }

  const childNodes = collectGroups(element)

  if (Object.keys(childNodes).length > 0) {
    node.children = childNodes
  }

  return node
}
