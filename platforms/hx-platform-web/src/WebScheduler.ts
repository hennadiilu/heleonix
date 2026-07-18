import { WebSchedulerJob } from "./WebSchedulerJob"

export class WebScheduler {
  private static readonly commitQueue = new Set<WebSchedulerJob>()

  private static commitScheduled = false

  public static scheduleFrame(job: WebSchedulerJob): void {
    this.commitQueue.add(job)

    if (!this.commitScheduled) {
      this.commitScheduled = true

      window.requestAnimationFrame(this.flushCommit)
    }
  }

  private static readonly flushCommit = (): void => {
    this.commitScheduled = false

    for (const job of this.commitQueue) {
      void job()
    }

    this.commitQueue.clear()
  }
}
