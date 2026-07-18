import { XmlCompiler, ICompilerOptions, IXmlElement } from "@heleonix/hx-compiler-core"
import type { IDimension, DimensionUsage, Kind } from "@heleonix/hx-language"
import type { IStyleDefinition, IStyleRule } from "@heleonix/hx-language"

const ROOT_TAG = "Style"

export class StyleCompiler extends XmlCompiler<IStyleDefinition> {
  protected get rootTag(): string {
    return ROOT_TAG
  }

  protected get kind(): Kind {
    return "style"
  }

  protected compileElement(root: IXmlElement, dimension: IDimension, options: ICompilerOptions): IStyleDefinition {
    return {
      name: options.name ?? "",
      dimension,
      usage: normalizeUsage(root.attributes["usage"]),
      rules: collectRules(root),
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

function collectRules(element: IXmlElement): IStyleRule[] {
  const rules: IStyleRule[] = []

  for (const child of element.children) {
    if (child.type !== "element") {
      continue
    }

    const rule: IStyleRule = {
      tag: child.tag,
      attributes: child.attributes,
    }

    const nested = collectRules(child)

    if (nested.length > 0) {
      rule.children = nested
    }

    rules.push(rule)
  }

  return rules
}
