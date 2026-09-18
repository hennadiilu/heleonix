import { Errors, HeleonixError } from "@heleonix/hx-core"
import type { IScheduler, SchedulerJob } from "@heleonix/hx-core"

type SchedulerPhase = "compute" | "commit"

const reportAsUnhandled = (error: HeleonixError): void => {
  void Promise.reject(error)
}

export class WebScheduler implements IScheduler {
  private readonly computeQueue = new Set<SchedulerJob>()

  private readonly commitQueue = new Set<SchedulerJob>()

  private readonly reportError: (error: HeleonixError) => void

  private computeScheduled = false

  private commitScheduled = false

  public constructor(reportError: (error: HeleonixError) => void = reportAsUnhandled) {
    this.reportError = reportError
  }

  public clear(): void {
    this.computeQueue.clear()
    this.commitQueue.clear()
  }

  public scheduleCompute(job: SchedulerJob): void {
    this.computeQueue.add(job)

    if (!this.computeScheduled) {
      this.computeScheduled = true

      window.queueMicrotask(this.flushCompute)
    }
  }

  public scheduleCommit(job: SchedulerJob): void {
    this.commitQueue.add(job)

    if (!this.commitScheduled) {
      this.commitScheduled = true

      window.requestAnimationFrame(() => this.flushCommit())
    }
  }

  private readonly flushCompute = (): void => {
    this.computeScheduled = false

    this.flush(this.computeQueue, "compute")
  }

  private readonly flushCommit = (): void => {
    this.commitScheduled = false

    this.flush(this.commitQueue, "commit")
  }

  private flush(queue: Set<SchedulerJob>, phase: SchedulerPhase): void {
    const jobs = Array.from(queue)

    queue.clear()

    for (const job of jobs) {
      try {
        const result = job()

        if (result instanceof Promise) {
          result.catch((e: unknown) => this.reportJobError(phase, e))
        }
      } catch (e) {
        this.reportJobError(phase, e)
      }
    }
  }

  private reportJobError(phase: SchedulerPhase, error: unknown): void {
    this.reportError(new HeleonixError(Errors.schedulerJob, phase, String(error)))
  }
}
