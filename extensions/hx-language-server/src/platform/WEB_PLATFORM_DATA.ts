import htmlDataJson from "@vscode/web-custom-data/data/browsers.html-data.json"
import { IDocs } from "@heleonix/hx-language"
import { IPlatformComponentData } from "./IPlatformComponentData"
import {
  IWebCustomAttribute,
  IWebCustomData,
  IWebCustomDescription,
  IWebCustomReference,
  IWebCustomTag,
} from "./IWebCustomData"

const htmlData: IWebCustomData = htmlDataJson

/**
 * Web platform component data: HTML elements per their W3C/MDN definitions,
 * from the same dataset VS Code's built-in HTML support uses
 * (`@vscode/web-custom-data`, bundled into the server at build time). Lookups
 * are case-sensitive on the lowercase element names, matching what
 * `WebComponentDefinitionSource` accepts at runtime.
 */
export const WEB_PLATFORM_DATA: IPlatformComponentData = createWebPlatformData()

function createWebPlatformData(): IPlatformComponentData {
  const tagsByName = new Map<string, IWebCustomTag>()
  const globalAttributes = new Map<string, IWebCustomAttribute>()
  const valueSets = new Map<string, readonly { name: string }[]>()
  const attributesByTag = new Map<string, Map<string, IWebCustomAttribute>>()
  const namesByTag = new Map<string, readonly string[]>()

  for (const tag of htmlData.tags ?? []) {
    tagsByName.set(tag.name, tag)
  }

  for (const attribute of htmlData.globalAttributes ?? []) {
    globalAttributes.set(attribute.name, attribute)
  }

  for (const valueSet of htmlData.valueSets ?? []) {
    valueSets.set(valueSet.name, valueSet.values)
  }

  const tagNames = [...tagsByName.keys()].sort()

  const attributesOf = (tag: string): Map<string, IWebCustomAttribute> | undefined => {
    const data = tagsByName.get(tag)

    if (!data) {
      return undefined
    }

    let attributes = attributesByTag.get(tag)

    if (!attributes) {
      attributes = new Map(globalAttributes)

      // Element-specific attributes win over same-named globals: their
      // descriptions/value sets are the specific ones.
      for (const attribute of data.attributes ?? []) {
        attributes.set(attribute.name, attribute)
      }

      attributesByTag.set(tag, attributes)
    }

    return attributes
  }

  const docsOf = (
    description: IWebCustomDescription | undefined,
    references: readonly IWebCustomReference[] | undefined,
    values: readonly { name: string }[] | undefined,
  ): IDocs | undefined => {
    const docs: IDocs = {}
    const summary = typeof description === "string" ? description : description?.value

    if (summary) {
      docs.summary = values?.length
        ? `${summary}\n\n*Values:* ${values.map((value) => `\`${value.name}\``).join(", ")}`
        : summary
    } else if (values?.length) {
      docs.summary = `*Values:* ${values.map((value) => `\`${value.name}\``).join(", ")}`
    }

    if (references?.length) {
      docs.see = references.map((reference) => `[${reference.name}](${reference.url})`)
    }

    return Object.keys(docs).length > 0 ? docs : undefined
  }

  return {
    id: "web",

    hasTag: (name) => tagsByName.has(name),

    tags: () => tagNames,

    tagDocs: (name) => {
      const tag = tagsByName.get(name)
      return tag ? docsOf(tag.description, tag.references, undefined) : undefined
    },

    attributes: (tag) => {
      let names = namesByTag.get(tag)

      if (!names) {
        const attributes = attributesOf(tag)

        if (!attributes) {
          return []
        }

        names = [...attributes.keys()].sort()
        namesByTag.set(tag, names)
      }

      return names
    },

    // `data-*`/`aria-*` are the HTML spec's author-defined attribute families,
    // valid on every element.
    hasAttribute: (tag, attribute) =>
      attribute.startsWith("data-") || attribute.startsWith("aria-") || Boolean(attributesOf(tag)?.has(attribute)),

    attributeDocs: (tag, attribute) => {
      const data = attributesOf(tag)?.get(attribute)

      if (!data) {
        return undefined
      }

      const values = data.values ?? (data.valueSet ? valueSets.get(data.valueSet) : undefined)

      return docsOf(data.description, data.references, values)
    },
  }
}
