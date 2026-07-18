import { FrameworkElement } from "../FrameworkElement"
import { PlatformAdapter } from "../platform/PlatformAdapter"
import { SchedulerJob } from "./SchedulerJob"

export class Scheduler extends FrameworkElement<PlatformAdapter> {
  private readonly platformAdapter = this.inject(PlatformAdapter)

  private readonly computeQueue = new Set<SchedulerJob>()

  private computeScheduled = false

  public static get diName(): string {
    return "Scheduler"
  }

  public scheduleCompute(job: SchedulerJob): void {
    this.computeQueue.add(job)

    if (!this.computeScheduled) {
      this.computeScheduled = true

      this.platformAdapter.scheduleTask(this.flushCompute)
    }
  }

  private readonly flushCompute = (): void => {
    this.computeScheduled = false

    const jobs = Array.from(this.computeQueue)

    this.computeQueue.clear()

    for (const job of jobs) {
      const result = job()

      if (result instanceof Promise) {
        result.catch(this.handleComputeError)
      }
    }
  }

  private readonly handleComputeError = (): void => {}
}
