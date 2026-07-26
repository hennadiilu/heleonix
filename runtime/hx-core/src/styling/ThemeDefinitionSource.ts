import type { IDimension, IThemeDefinition } from "@heleonix/hx-language"
import { FrameworkElement } from "../FrameworkElement"

/**
 * A source of compiled `*.hxt` theme partials. The theme is singular per
 * application, so a source returns all its partials (no name) for the
 * {@link ThemeDefinitionProvider} to merge into the one application theme.
 */
export abstract class ThemeDefinitionSource extends FrameworkElement {
  public abstract getDefinitions(dimension: IDimension): Promise<readonly IThemeDefinition[]>
}
