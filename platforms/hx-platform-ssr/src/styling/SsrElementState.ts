/**
 * The server-side stand-in for one component's root element: the classes,
 * attributes and inline styles the {@link SsrStyleEffect} writes, which
 * {@link renderElementAttributes} turns into the element's opening-tag markup.
 * `styles` holds both mangled `--hx-*` variables and direct CSS properties, in
 * write order, so output is deterministic and matches a client re-render.
 */
export class SsrElementState {
  public readonly classes = new Set<string>()

  public readonly attributes = new Map<string, string>()

  public readonly styles = new Map<string, string>()
}
