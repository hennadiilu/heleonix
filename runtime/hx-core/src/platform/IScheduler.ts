import type { SchedulerJob } from "./SchedulerJob"

export interface IScheduler {
  scheduleCompute(job: SchedulerJob): void

  scheduleCommit(job: SchedulerJob): void
}
