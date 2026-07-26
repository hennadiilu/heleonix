import { PlatformAdapter, PlatformComponent } from "@heleonix/hx-core"
import type { Component, StyleEnginePlatform } from "@heleonix/hx-core"
import type { IThemeDefinition } from "@heleonix/hx-language"
import { WebPlatformComponent } from "./WebPlatformComponent"
import { WebStyleEnginePlatform } from "./styling/WebStyleEnginePlatform"
import { StyleWriteScheduler } from "./styling/StyleWriteScheduler"
import { RefcountedStyleSheet } from "./styling/RefcountedStyleSheet"
import { DomStyleSheet } from "./styling/DomStyleSheet"
import { composeThemeArtifacts } from "./styling/composeThemeArtifacts"
import { mangleVariable } from "./styling/mangleVariable"

export class WebPlatformAdapter extends PlatformAdapter {
  private styleEngine?: StyleEnginePlatform<Component>

  private artifactSheet?: HTMLStyleElement

  private themeRoot?: HTMLElement

  private readonly sheets: HTMLStyleElement[] = []

  private readonly publishedVariables = new Set<string>()

  public get styleEnginePlatform(): StyleEnginePlatform<Component> {
    if (!this.styleEngine) {
      const sheet = new RefcountedStyleSheet(new DomStyleSheet(this.createSheet()))
      const scheduler = new StyleWriteScheduler((flush) => window.requestAnimationFrame(flush))

      this.styleEngine = new WebStyleEnginePlatform<Component>(
        sheet,
        (component) => (component as unknown as WebPlatformComponent).roots,
        scheduler,
      )
    }

    return this.styleEngine
  }

  public scheduleTask(callback: () => void): void {
    window.queueMicrotask(callback)
  }

  public getRootHost(selector: string): PlatformComponent | null {
    const element = document.querySelector<HTMLElement>(selector)

    if (!element) {
      return null
    }

    // The application's root host is where theme variables are published, so
    // instances on one page can hold different themes (nothing at `:root`).
    this.themeRoot = element

    const host = this.inject(WebPlatformComponent)

    host.adoptNative(element)

    return host
  }

  public applyThemeTokens(tokens: ReadonlyMap<string, string>): void {
    const root = this.themeRoot ?? document.documentElement

    for (const [path, value] of tokens) {
      const property = mangleVariable(path)

      root.style.setProperty(property, value)
      this.publishedVariables.add(property)
    }
  }

  public applyThemeArtifacts(theme: IThemeDefinition): void {
    if (!this.artifactSheet) {
      this.artifactSheet = this.createSheet()
    }

    this.artifactSheet.textContent = composeThemeArtifacts(theme)
  }

  public override dispose(): void {
    for (const sheet of this.sheets) {
      sheet.remove()
    }

    for (const property of this.publishedVariables) {
      this.themeRoot?.style.removeProperty(property)
    }

    this.sheets.length = 0
    this.publishedVariables.clear()
    this.styleEngine = undefined
    this.artifactSheet = undefined
  }

  /**
   * Creates a `<style>` element under this application's root host, so its sheet
   * lives with the app (removed when the root is) and never touches the shared
   * document head - keeping multiple application instances on one page isolated.
   * Falls back to the head only if the root host has not been established yet.
   */
  private createSheet(): HTMLStyleElement {
    const element = document.createElement("style")

    ;(this.themeRoot ?? document.head).appendChild(element)
    this.sheets.push(element)

    return element
  }
}
