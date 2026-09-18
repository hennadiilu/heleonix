export interface IDocs {
  summary?: string

  deprecated?: string

  examples?: string[]

  see?: string[]

  props?: Record<string, string>

  params?: Record<string, string>

  entries?: Record<string, IDocs>
}
