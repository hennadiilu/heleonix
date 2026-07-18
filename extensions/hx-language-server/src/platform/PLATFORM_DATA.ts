import { IPlatformComponentData } from "./IPlatformComponentData"
import { WEB_PLATFORM_DATA } from "./WEB_PLATFORM_DATA"

/**
 * Every registered platform's component data. Supporting a new platform means
 * adding its {@link IPlatformComponentData} implementation here - completion,
 * diagnostics and hover consume only the {@link PLATFORM_DATA} aggregate and
 * pick it up unchanged.
 */
const PLATFORMS: readonly IPlatformComponentData[] = [WEB_PLATFORM_DATA]

/**
 * The platform component data the editor features consume: the union of every
 * registered platform (a workspace's target platform isn't knowable from
 * source alone, so tags/attributes of all platforms are offered and accepted).
 * Docs lookups return the first platform's answer.
 */
export const PLATFORM_DATA: IPlatformComponentData = createAggregate(PLATFORMS)

function createAggregate(platforms: readonly IPlatformComponentData[]): IPlatformComponentData {
  let tagNames: readonly string[] | undefined
  const attributeNames = new Map<string, readonly string[]>()

  return {
    id: platforms.map((platform) => platform.id).join("+"),

    hasTag: (name) => platforms.some((platform) => platform.hasTag(name)),

    tags: () => {
      tagNames ??= [...new Set(platforms.flatMap((platform) => [...platform.tags()]))].sort()
      return tagNames
    },

    tagDocs: (name) => {
      for (const platform of platforms) {
        const docs = platform.tagDocs(name)

        if (docs) {
          return docs
        }
      }

      return undefined
    },

    attributes: (tag) => {
      let names = attributeNames.get(tag)

      if (!names) {
        names = [...new Set(platforms.flatMap((platform) => [...platform.attributes(tag)]))].sort()
        attributeNames.set(tag, names)
      }

      return names
    },

    hasAttribute: (tag, attribute) => platforms.some((platform) => platform.hasAttribute(tag, attribute)),

    attributeDocs: (tag, attribute) => {
      for (const platform of platforms) {
        const docs = platform.attributeDocs(tag, attribute)

        if (docs) {
          return docs
        }
      }

      return undefined
    },
  }
}
