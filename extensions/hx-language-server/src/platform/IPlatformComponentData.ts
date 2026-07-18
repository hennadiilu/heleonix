import { IDocs } from "@heleonix/hx-language"

/**
 * Metadata of one platform's native components (the tags a `PlatformComponent`
 * implementation renders, e.g. HTML elements for the web platform), powering
 * completion, diagnostics and hover for tags the definition index doesn't
 * know. The web implementation is {@link WEB_PLATFORM_DATA}; future platforms
 * (native, SSR) provide their own data behind this same interface and register
 * it in {@link PLATFORM_DATA} - the only platform data the editor features
 * consume.
 */
export interface IPlatformComponentData {
  /** Platform id, e.g. `web`. */
  readonly id: string

  hasTag(name: string): boolean

  /** All tag names, sorted. */
  tags(): readonly string[]

  tagDocs(name: string): IDocs | undefined

  /** Element-specific plus global attribute names of `tag`, sorted (enumerable names only). */
  attributes(tag: string): readonly string[]

  /**
   * Whether `attribute` is valid on `tag`. This is the platform's whole
   * validity policy, including author-defined attribute families it allows
   * beyond the enumerable {@link attributes} (e.g. `data-*`/`aria-*` on the
   * web) - callers apply no platform-specific allowances of their own.
   */
  hasAttribute(tag: string, attribute: string): boolean

  attributeDocs(tag: string, attribute: string): IDocs | undefined
}
