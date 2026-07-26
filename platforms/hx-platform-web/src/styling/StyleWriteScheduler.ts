/** How a scheduler defers a flush - a frame callback in the browser, immediate elsewhere. */
export type FrameSchedule = (flush: () => void) => void

/**
 * Coalesces the effect's DOM writes into one batch flushed together, so a burst
 * of `setClass`/`setVariable`/... during a component's styling touches the DOM
 * once per frame instead of thrashing layout. Writes run in submission order, so
 * an apply-then-remove within the same frame nets out correctly. The browser
 * wires a `requestAnimationFrame` flush; the {@link synchronousScheduler} runs
 * writes immediately (the default, and how SSR and tests stay synchronous).
 */
export class StyleWriteScheduler {
  private readonly queue: (() => void)[] = []

  private scheduled = false

  private readonly schedule: FrameSchedule

  public constructor(schedule: FrameSchedule) {
    this.schedule = schedule
  }

  public write(operation: () => void): void {
    this.queue.push(operation)

    if (!this.scheduled) {
      this.scheduled = true
      this.schedule(() => this.flush())
    }
  }

  public flush(): void {
    this.scheduled = false

    const operations = this.queue.splice(0)

    for (const operation of operations) {
      operation()
    }
  }
}

/** Applies writes immediately - the default scheduler, keeping non-batched callers synchronous. */
export const synchronousScheduler = new StyleWriteScheduler((flush) => flush())
