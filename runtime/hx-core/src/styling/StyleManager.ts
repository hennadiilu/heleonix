import { parseRuleKey } from "@heleonix/hx-language"
import type { IStyleDefinition } from "@heleonix/hx-language"
import { FrameworkElement } from "../FrameworkElement"
import { Component } from "../components/Component"
import { ComponentManager } from "../components/ComponentManager"
import { ComponentScopeResolver } from "./ComponentScopeResolver"
import { DimensionManager } from "../dimension/DimensionManager"
import { PlatformAdapter } from "../platform/PlatformAdapter"
import { StateManager } from "../state/StateManager"
import { expandApplies } from "./expandApplies"
import { IfQualifier } from "./IfQualifier"
import { MediaQualifier } from "./MediaQualifier"
import { PseudoQualifier } from "./PseudoQualifier"
import { QualifierRegistry } from "./QualifierRegistry"
import { StateManagerStyleState } from "./StateManagerStyleState"
import { StyleDefinitionProvider } from "./StyleDefinitionProvider"
import { StyleEngine } from "./StyleEngine"
import { ThemeDefinitionProvider } from "./ThemeDefinitionProvider"
import { UnlessQualifier } from "./UnlessQualifier"
import { IDIContainer } from "../injection/IDIContainer"

/**
 * Orchestrates styling over the component lifecycle: it applies a component's
 * merged style on {@link ComponentManager.componentBuilt} - resolving it and
 * handing it to a {@link StyleEngine} built on the platform's back-end and a
 * `StateManager`-backed reactive seam - and tears it down on
 * `componentDestroyed`; a dimension change re-applies every styled component, and
 * a newly built descendant re-resolves its scoped (`@hx-style(for:)`) ancestors. The
 * built-in qualifiers are registered here (the pseudo family as the default, so
 * every non-framework segment name is a pseudo). Platform-agnostic - the same
 * manager drives the web and, later, SSR.
 */
export class StyleManager extends FrameworkElement<
  | PlatformAdapter
  | StateManager
  | StyleDefinitionProvider
  | ThemeDefinitionProvider
  | ComponentManager
  | DimensionManager
> {
  private readonly platformAdapter = this.inject(PlatformAdapter)

  private readonly definitionProvider = this.inject(StyleDefinitionProvider)

  private readonly themeProvider = this.inject(ThemeDefinitionProvider)

  private readonly componentManager = this.inject(ComponentManager)

  private readonly dimensionManager = this.inject(DimensionManager)

  private readonly registry = new QualifierRegistry()

  private readonly engine: StyleEngine<Component>

  private readonly styled = new Set<Component>()

  // Styled components whose style has a `@hx-style(for: ...)` rule, so a newly
  // built descendant can trigger them to re-resolve their scope and pick it up.
  private readonly scopedStyled = new Set<Component>()

  public constructor(diContainer: IDIContainer) {
    super(diContainer)

    this.registry.setDefault(new PseudoQualifier(diContainer))
    this.registry.register("Media", new MediaQualifier(diContainer))
    this.registry.register("If", new IfQualifier(diContainer))
    this.registry.register("Unless", new UnlessQualifier(diContainer))

    this.engine = new StyleEngine<Component>(
      this.registry,
      this.platformAdapter.styleEnginePlatform,
      new StateManagerStyleState(this.inject(StateManager)),
      new ComponentScopeResolver(),
    )

    this.componentManager.componentBuilt.on((_fq, instance) => void this.onComponentBuilt(instance))
    this.componentManager.componentDestroyed.on((_fq, instance) => this.remove(instance))
    this.dimensionManager.dimensionChanged.on(() => void this.reapply())
  }

  public static get diName(): string {
    return "StyleManager"
  }

  public async apply(component: Component): Promise<void> {
    const definition = await this.resolveDefinition(component.definition.tag)

    if (definition) {
      this.engine.apply(component, definition)
      this.styled.add(component)

      if (hasScopeRule(definition)) {
        this.scopedStyled.add(component)
      } else {
        this.scopedStyled.delete(component)
      }
    }
  }

  public remove(component: Component): void {
    this.engine.remove(component)
    this.styled.delete(component)
    this.scopedStyled.delete(component)
  }

  /**
   * Styles a newly built component, then re-resolves every already-styled
   * ancestor that has a `@hx-style(for: ...)` rule so its scope picks up this new
   * descendant - the scoped class lands on it immediately instead of waiting for
   * the next dimension-change reapply. (The engine's remove-first re-apply is
   * batched, so existing targets do not flicker.)
   */
  private async onComponentBuilt(component: Component): Promise<void> {
    await this.apply(component)

    for (let ancestor = component.parent; ancestor; ancestor = ancestor.parent) {
      if (this.scopedStyled.has(ancestor)) {
        await this.apply(ancestor)
      }
    }
  }

  private async reapply(): Promise<void> {
    for (const component of this.styled) {
      const definition = await this.resolveDefinition(component.definition.tag)

      if (definition) {
        this.engine.apply(component, definition)
      }
    }
  }

  private async resolveDefinition(tag: string): Promise<IStyleDefinition | undefined> {
    const definition = await this.definitionProvider.getDefinition(tag)

    if (!definition?.applies) {
      return definition
    }

    const theme = await this.themeProvider.getTheme()

    return theme ? expandApplies(definition, theme.groups) : definition
  }
}

/** Whether any of a style's rules is scoped by `@hx-style(for: ...)`. */
function hasScopeRule(definition: IStyleDefinition): boolean {
  return Object.keys(definition.rules).some((signature) =>
    parseRuleKey(signature).some((usage) => usage.name === "Style"),
  )
}
