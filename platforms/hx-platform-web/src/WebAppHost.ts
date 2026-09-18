import { LazyStyleElement } from "./styling/LazyStyleElement"
import type { StyleSheetElement } from "./styling/DomStyleSheet"

export class WebAppHost {
  private root: HTMLElement | undefined

  private readonly elements: HTMLStyleElement[] = []

  private readonly publishedVariables = new Map<string, string>()

  public get rootElement(): HTMLElement | undefined {
    return this.root
  }

  public setRoot(element: HTMLElement): void {
    const previous = this.variableTarget()

    this.root = element

    for (const created of this.elements) {
      element.appendChild(created)
    }

    for (const [property, value] of this.publishedVariables) {
      previous.style.removeProperty(property)
      element.style.setProperty(property, value)
    }
  }

  public createSheet(): StyleSheetElement {
    return new LazyStyleElement(() => this.appendStyleElement())
  }

  public publishVariable(property: string, value: string): void {
    this.variableTarget().style.setProperty(property, value)

    this.publishedVariables.set(property, value)
  }

  public clear(): void {
    for (const element of this.elements) {
      element.remove()
    }

    const target = this.variableTarget()

    for (const property of this.publishedVariables.keys()) {
      target.style.removeProperty(property)
    }

    this.elements.length = 0

    this.publishedVariables.clear()

    this.root = undefined
  }

  private variableTarget(): HTMLElement {
    return this.root ?? document.documentElement
  }

  private appendStyleElement(): HTMLStyleElement {
    const element = document.createElement("style")

    ;(this.root ?? document.head).appendChild(element)

    this.elements.push(element)

    return element
  }
}
