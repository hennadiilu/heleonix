/**
 * The SSR `StyleHandle`: a content-hashed class name, identical to the web's -
 * so the class a component carries in server-rendered HTML matches the one the
 * client would compute, and hydration is a no-op. The core treats it as opaque,
 * routing it back through the effect only.
 */
export interface SsrStyleHandle {
  readonly className: string
}
