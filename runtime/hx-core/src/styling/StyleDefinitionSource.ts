import type { IDimension, IStyleDefinition } from "@heleonix/hx-language"
import { FrameworkElement } from "../FrameworkElement"

/**
 * A source of compiled `*.hxs` style definitions - one per provenance (the
 * bundler-generated workspace definitions, a package, ...). Returns every
 * definition file for a component name so the {@link StyleDefinitionProvider}
 * can merge them across dimensions.
 */
export abstract class StyleDefinitionSource extends FrameworkElement {
  public abstract getDefinitions(name: string, dimension: IDimension): Promise<readonly IStyleDefinition[]>
}
