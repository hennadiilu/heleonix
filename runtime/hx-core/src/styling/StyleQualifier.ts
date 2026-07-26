import { FrameworkElement } from "../FrameworkElement"
import { StateManager } from "../state/StateManager"
import { ComponentManager } from "../components/ComponentManager"

/**
 * Base class for style qualifiers: DI-registered TypeScript classes that
 * interpret a rule-key segment (`@hx-if`, `@hx-style`, pseudo/media builtins).
 * Declared directly in TypeScript with no header - the analyzer discovers
 * concrete subclasses by this base type and reads the argument contract from
 * `TArgs` (the branded `PropertyRef`/`EventRef`/`ThemeTokenRef` members route
 * arg-value completion). The rule-key segment name is the class name minus the
 * required `Qualifier` suffix (`IfQualifier` -> `If`); the DI token is the full
 * class name via `static diName`.
 *
 * Subclasses implement the optional `build` and/or `attach` methods of
 * `IStyleQualifier` (both structural, so no explicit `implements` is needed).
 * Qualifiers may inject the state and component managers.
 */
export abstract class StyleQualifier<TArgs = object> extends FrameworkElement<StateManager | ComponentManager> {
  // The typed argument contract - read by the analyzer's class scan, never at
  // runtime. `declare` keeps it type-only, with no field emitted.
  declare protected readonly args: TArgs
}
