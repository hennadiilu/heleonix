import { StyleWriteScheduler } from "@heleonix/hx-platform-web"

describe("StyleWriteScheduler", () => {
  it("then coalesces writes into one deferred flush, preserving submission order", () => {
    let flush = (): void => {}
    const scheduler = new StyleWriteScheduler((run) => {
      flush = run
    })
    const log: string[] = []

    scheduler.write(() => log.push("a"))
    scheduler.write(() => log.push("b"))
    expect(log).toEqual([])

    flush()
    expect(log).toEqual(["a", "b"])
  })

  it("then schedules a fresh flush only after the previous batch drains", () => {
    let scheduled = 0
    let flush = (): void => {}
    const scheduler = new StyleWriteScheduler((run) => {
      scheduled += 1
      flush = run
    })

    scheduler.write(() => {})
    scheduler.write(() => {})
    expect(scheduled).toBe(1)

    flush()
    scheduler.write(() => {})
    expect(scheduled).toBe(2)
  })

  it("then applies writes immediately with a synchronous schedule", () => {
    const scheduler = new StyleWriteScheduler((run) => run())
    let applied = false

    scheduler.write(() => {
      applied = true
    })

    expect(applied).toBeTrue()
  })
})
