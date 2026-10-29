import { BindingEvaluator } from "../../src/bindings/BindingEvaluator"
import { LiteralBindingValueSource } from "../../src/bindings/LiteralBindingValueSource"
import type { IBindingValueSource } from "../../src/bindings/IBindingValueSource"
import { StateBindingValueSource } from "../../src/state/StateBindingValueSource"
import { QualifierProvider } from "../../src/styling/qualifiers/QualifierProvider"
import { StyleManager } from "../../src/styling/StyleManager"
import { ThemeManager } from "../../src/theming/ThemeManager"
import { ConverterProvider } from "../../src/converters/ConverterProvider"
import { DimensionManager } from "../../src/dimensions/DimensionManager"
import { DefinitionSource, ThemeDefinitionLoader } from "@heleonix/hx-core"
import type { Component, IState, IStyleDriver, StyleDefinitionLoader } from "@heleonix/hx-core"
import type { IStyleDefinition, IThemeDefinition } from "@heleonix/hx-language"

const components = new Map<string, Component>()

export function cmp(fqName: string): Component {
  let component = components.get(fqName)

  if (!component) {
    component = { fqName, children: [], usage: {} } as unknown as Component
    components.set(fqName, component)
  }

  return component
}

export interface FakeComponent {
  fqName: string
  definition: { tag: string }
  usage: { name?: string }
  children: FakeComponent[]
  parent?: FakeComponent
}

export function componentTree(tag: string, name?: string, parent?: FakeComponent): FakeComponent {
  const component: FakeComponent = {
    fqName: parent ? `${parent.fqName}.${tag}` : (name ?? tag),
    definition: { tag },
    usage: { name },
    children: [],
    parent,
  }

  parent?.children.push(component)

  return component
}

export function asComponent(component: FakeComponent): Component {
  return component as unknown as Component
}

export class FakeState {
  public readonly values: Record<string, unknown> = {}

  public readonly changed = {
    on: (key: string, handler: (key: string) => void): void => {
      this.handlers.set(key, [...(this.handlers.get(key) ?? []), handler])
    },
    off: (key: string, handler: (key: string) => void): void => {
      this.handlers.set(
        key,
        (this.handlers.get(key) ?? []).filter((h) => h !== handler),
      )
    },
  }

  private readonly handlers = new Map<string, ((key: string) => void)[]>()

  public getValue(name: string): unknown {
    return this.values[name]
  }

  public setValue(name: string, value: unknown): void {
    this.values[name] = value

    for (const handler of [...(this.handlers.get(name) ?? [])]) {
      handler(name)
    }
  }

  public emitEvent(): void {}

  public subscriberCount(name: string): number {
    return (this.handlers.get(name) ?? []).length
  }

  public asState(): IState {
    return this as unknown as IState
  }
}

export class FakeDefinitionLoader {
  private readonly byTag: Record<string, IStyleDefinition>

  public constructor(byTag: Record<string, IStyleDefinition> = {}) {
    this.byTag = byTag
  }

  public loadDefinition(tag: string): Promise<IStyleDefinition | undefined> {
    return Promise.resolve(this.byTag[tag])
  }

  public set(tag: string, definition: IStyleDefinition | undefined): void {
    if (definition) {
      this.byTag[tag] = definition
    } else {
      delete this.byTag[tag]
    }
  }

  public asLoader(): StyleDefinitionLoader {
    return this as unknown as StyleDefinitionLoader
  }
}

class ThemeSource extends DefinitionSource<IThemeDefinition> {
  public groups: IThemeDefinition["groups"] = {}

  public loadDefinitions(): Promise<readonly IThemeDefinition[]> {
    return Promise.resolve([{ name: "", dimension: {}, groups: this.groups }])
  }
}

export class FakeTheme {
  public readonly manager: ThemeManager

  private readonly source = new ThemeSource()

  private readonly loader: ThemeDefinitionLoader

  public constructor() {
    this.loader = new ThemeDefinitionLoader(new DimensionManager([]), [this.source])
    this.manager = new ThemeManager(this.loader, () => ({ applyTokens: () => {}, applyArtifacts: () => {} }))
  }

  public set groups(groups: IThemeDefinition["groups"]) {
    this.source.groups = groups
    this.loader.clear()
  }
}

export function entrySource(type: "dictionary" | "config", entries: Record<string, string>): IBindingValueSource {
  return { type, get: (path: string) => Promise.resolve(entries[path]) }
}

export interface ManagerParts {
  driver: IStyleDriver
  loader?: FakeDefinitionLoader
  theme?: FakeTheme
  state?: FakeState
  sources?: IBindingValueSource[]
  qualifiers?: QualifierProvider
}

export function managerWith(parts: ManagerParts): StyleManager {
  const state = (parts.state ?? new FakeState()).asState()

  return new StyleManager(
    () => parts.driver,
    (parts.loader ?? new FakeDefinitionLoader()).asLoader(),
    (parts.theme ?? new FakeTheme()).manager,
    state,
    new BindingEvaluator(new ConverterProvider(new Map(), () => ({}) as never), [
      new StateBindingValueSource(state),
      new LiteralBindingValueSource(),
      ...(parts.sources ?? []),
    ]),
    parts.qualifiers ?? new QualifierProvider(new Map()),
  )
}
