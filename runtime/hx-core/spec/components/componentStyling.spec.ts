import { PlatformComponent } from "@heleonix/hx-core"
import { ComponentManager } from "../../src/components/ComponentManager"
import type { StyleManager } from "../../src/styling/StyleManager"
import type { Component, IComponentContext, IComponentManager } from "@heleonix/hx-core"
import type { IComponentDefinition } from "@heleonix/hx-language"
import { managerWith } from "../styling/styleManagerFakes"

const emitter = { on: (): void => {}, off: (): void => {} }

class RecordingElement extends PlatformComponent {
  public static log: string[] = []

  public override mount(): void {
    RecordingElement.log.push("mount")
  }

  public override unmount(): void {
    RecordingElement.log.push("unmount")
  }

  public override destroy(): void {
    RecordingElement.log.push("destroy")

    super.destroy()
  }

  public override setProperty(): void {}

  public override setContent(): void {}
}

function createStyles(): { styles: StyleManager; applied: jasmine.Spy; removed: jasmine.Spy } {
  const styles = managerWith({ driver: { insertRule: () => {}, remove: () => {}, effectFor: () => ({}) as never } })
  const apply = styles.apply.bind(styles)
  const remove = styles.remove.bind(styles)

  const applied = spyOn(styles, "apply").and.callFake(async (component: Component) => {
    await apply(component)

    RecordingElement.log.push("styled")
  })

  const removed = spyOn(styles, "remove").and.callFake((component: Component) => {
    remove(component)

    RecordingElement.log.push("unstyled")
  })

  return { styles, applied, removed }
}

function createContext(components: () => IComponentManager): IComponentContext {
  return {
    state: { changed: emitter, getValue: () => undefined, setValue: () => {}, emitEvent: () => {} },
    configs: { get: () => Promise.resolve(undefined) },
    dictionaries: { get: () => undefined },
    binder: {
      bind: () => undefined,
      unbind: () => {},
      rebind: () => {},
      getActiveEndpoints: () => [],
      endpointActivated: emitter,
      endpointDeactivated: emitter,
    },
    get components(): IComponentManager {
      return components()
    },
    scheduler: { scheduleCompute: () => {}, scheduleCommit: () => {} },
  } as unknown as IComponentContext
}

function createManager(styles: StyleManager | undefined): ComponentManager {
  const definition = { tag: "el", type: "RecordingElement" } as IComponentDefinition

  const manager = new ComponentManager(
    { loadDefinition: () => Promise.resolve(definition) } as never,
    { current: {} } as never,
    {} as never,
    new Map<string, never>([["RecordingElement", RecordingElement as never]]),
    () => context,
    styles,
  )

  const context = createContext(() => manager)

  RecordingElement.log = []

  return manager
}

describe("ComponentManager styling", () => {
  it("then styles a component and awaits it before the component mounts", async () => {
    const { styles, applied } = createStyles()
    const manager = createManager(styles)

    const component = await manager.build({ tag: "el" }, undefined, undefined, undefined)

    expect(applied).toHaveBeenCalledOnceWith(component)
    expect(RecordingElement.log).toEqual(["styled", "mount"])
  })

  it("then removes the styling while the component is still intact, before it is destroyed", async () => {
    const { styles, removed } = createStyles()
    const manager = createManager(styles)

    const component = await manager.build({ tag: "el" }, undefined, undefined, undefined)

    RecordingElement.log = []

    manager.destroy(component)

    expect(removed).toHaveBeenCalledOnceWith(component)
    expect(RecordingElement.log).toEqual(["unmount", "unstyled", "destroy"])
  })

  it("then builds and destroys components when the application bootstraps no styles", async () => {
    const manager = createManager(undefined)

    const component = await manager.build({ tag: "el" }, undefined, undefined, undefined)

    manager.destroy(component)

    expect(RecordingElement.log).toEqual(["mount", "unmount", "destroy"])
  })
})
