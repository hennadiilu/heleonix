import type { HeleonixError } from "@heleonix/hx-core"
import { WebScheduler } from "@heleonix/hx-platform-web"

interface WindowStub {
  queueMicrotask(callback: () => void): void
  requestAnimationFrame(callback: () => void): number
}

interface Deferrals {
  tasks: (() => void)[]
  frames: (() => void)[]
}

const withWindowStub = (run: (stub: Deferrals) => void): void => {
  const tasks: (() => void)[] = []
  const frames: (() => void)[] = []
  const globals = globalThis as unknown as { window?: WindowStub }
  const original = globals.window

  globals.window = {
    queueMicrotask: (callback) => tasks.push(callback),
    requestAnimationFrame: (callback) => frames.push(callback) as unknown as number,
  }

  try {
    run({ tasks, frames })
  } finally {
    globals.window = original
  }
}

describe("WebScheduler", () => {
  it("then coalesces compute jobs into one microtask flush", () => {
    withWindowStub(({ tasks, frames }) => {
      const scheduler = new WebScheduler()
      const log: string[] = []

      scheduler.scheduleCompute(() => log.push("a"))
      scheduler.scheduleCompute(() => log.push("b"))

      expect(log).toEqual([])
      expect(tasks.length).toBe(1)
      expect(frames.length).toBe(0)

      tasks[0]()
      expect(log).toEqual(["a", "b"])
    })
  })

  it("then coalesces commit jobs into one animation frame, deduplicating a repeated job", () => {
    withWindowStub(({ tasks, frames }) => {
      const scheduler = new WebScheduler()
      const log: string[] = []
      const job = (): void => void log.push("write")

      scheduler.scheduleCommit(job)
      scheduler.scheduleCommit(job)

      expect(frames.length).toBe(1)
      expect(tasks.length).toBe(0)

      frames[0]()
      expect(log).toEqual(["write"])
    })
  })

  it("then flushes style writes and property writes in the same frame", () => {
    withWindowStub(({ frames }) => {
      const scheduler = new WebScheduler()
      const log: string[] = []

      scheduler.scheduleCommit(() => log.push("property"))
      scheduler.scheduleCommit(() => log.push("style"))

      expect(frames.length).toBe(1)

      frames[0]()
      expect(log).toEqual(["property", "style"])
    })
  })

  it("then keeps the two phases independent", () => {
    withWindowStub(({ tasks, frames }) => {
      const scheduler = new WebScheduler()
      const log: string[] = []

      scheduler.scheduleCompute(() => log.push("compute"))
      scheduler.scheduleCommit(() => log.push("commit"))

      expect(tasks.length).toBe(1)
      expect(frames.length).toBe(1)

      frames[0]()
      expect(log).toEqual(["commit"])

      tasks[0]()
      expect(log).toEqual(["commit", "compute"])
    })
  })

  it("then schedules a fresh flush for jobs queued after the previous one drained", () => {
    withWindowStub(({ tasks }) => {
      const scheduler = new WebScheduler()
      const log: string[] = []

      scheduler.scheduleCompute(() => log.push("first"))
      tasks[0]()

      scheduler.scheduleCompute(() => log.push("second"))
      expect(tasks.length).toBe(2)

      tasks[1]()
      expect(log).toEqual(["first", "second"])
    })
  })

  it("then reports a throwing job and still runs the jobs queued behind it", () => {
    withWindowStub(({ tasks }) => {
      const errors: HeleonixError[] = []
      const scheduler = new WebScheduler((error) => errors.push(error))
      const log: string[] = []

      scheduler.scheduleCompute(() => {
        throw new Error("boom")
      })
      scheduler.scheduleCompute(() => log.push("survivor"))

      tasks[0]()

      expect(log).toEqual(["survivor"])
      expect(errors.length).toBe(1)
      expect(String(errors[0])).toContain("boom")
    })
  })

  it("then reports a rejecting async job without stopping the flush", async () => {
    const errors: HeleonixError[] = []
    const log: string[] = []
    let flushFrame: (() => void) | undefined

    withWindowStub(({ frames }) => {
      const scheduler = new WebScheduler((error) => errors.push(error))

      scheduler.scheduleCommit(() => Promise.reject(new Error("async boom")))
      scheduler.scheduleCommit(() => log.push("survivor"))

      flushFrame = frames[0]
      flushFrame()
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(log).toEqual(["survivor"])
    expect(errors.length).toBe(1)
    expect(String(errors[0])).toContain("async boom")
  })

  it("then drops queued jobs on clear, so teardown work never flushes into a torn-down host", () => {
    withWindowStub(({ tasks, frames }) => {
      const scheduler = new WebScheduler()
      const log: string[] = []

      scheduler.scheduleCompute(() => log.push("compute"))
      scheduler.scheduleCommit(() => log.push("commit"))

      scheduler.clear()

      tasks[0]()
      frames[0]()

      expect(log).toEqual([])
    })
  })

  it("then stays usable after clear, so a restarted application schedules normally", () => {
    withWindowStub(({ frames }) => {
      const scheduler = new WebScheduler()
      const log: string[] = []

      scheduler.scheduleCommit(() => log.push("dropped"))
      scheduler.clear()

      // The pending frame from before the clear is still the one that flushes:
      // clear leaves the scheduled flag set precisely so no second frame is asked for.
      scheduler.scheduleCommit(() => log.push("kept"))
      expect(frames.length).toBe(1)

      frames[0]()
      expect(log).toEqual(["kept"])
    })
  })
})
