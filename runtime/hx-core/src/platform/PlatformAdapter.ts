import type { IThemeDefinition } from "@heleonix/hx-language"
import { FrameworkElement } from "../FrameworkElement"
import type { PlatformComponent } from "../components/PlatformComponent"
import type { Component } from "../components/Component"
import type { StyleEnginePlatform } from "../styling/StyleEnginePlatform"

export abstract class PlatformAdapter extends FrameworkElement<PlatformComponent> {
  public static get diName(): string {
    return "PlatformAdapter"
  }

  /**
   * The platform's styling back-end for the core {@link StyleEngine}: `compose`
   * (neutral fragments + declarations -> an opaque class handle) and `effectFor`
   * (a component's per-instance style effect). The web builds CSS; an SSR
   * platform serializes to HTML strings.
   */
  public abstract get styleEnginePlatform(): StyleEnginePlatform<Component>

  /**
   * Releases platform resources the adapter attached to the app root when the
   * application stops (web: removes its `<style>` sheets and published theme
   * variables). A no-op by default; platforms override as needed.
   */
  public dispose(): void {}

  public abstract scheduleTask(callback: () => void): void

  public abstract getRootHost(selector: string): PlatformComponent | null

  /** Publishes the resolved theme tokens as platform variables (web: `--hx-*` at the app root). */
  public abstract applyThemeTokens(tokens: ReadonlyMap<string, string>): void

  /**
   * Publishes the theme's app-level `@`-artifacts (`@keyframes`/`@font-face`/
   * `@counter-style`) once per app - wholesale, so a dimension re-apply drops
   * any the new theme no longer declares (web: an artifact `<style>` block, SSR
   * serializes into HTML).
   */
  public abstract applyThemeArtifacts(theme: IThemeDefinition): void
}
