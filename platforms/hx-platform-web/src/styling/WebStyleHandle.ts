/**
 * The web's concrete {@link StyleHandle}: a content-hashed class name. The core
 * treats it as opaque and only routes it back through `setClass`/`removeClass`;
 * the web reads the class off it.
 */
export interface WebStyleHandle {
  readonly className: string
}
