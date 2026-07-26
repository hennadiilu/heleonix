declare const styleHandleBrand: unique symbol

/**
 * An opaque handle to a platform-generated style artifact (a CSS class on web, a
 * native style object elsewhere). The core never inspects it - it only routes it
 * back through {@link StyleEffect}'s `setClass`/`removeClass`; the platform
 * mints and interprets it.
 */
export type StyleHandle = { readonly [styleHandleBrand]: never }
