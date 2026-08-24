/** Presentation shapes over the board Remote JSON — the field names these
 * surfaces render, never a second statistics layer. Every field is optional: a
 * live poll can land mid-write and board.store omits absent kinds. Types only,
 * no runtime code. */

/** One stage of a task node (grasp / place / …), with its sealed verdict. */
export interface Stage {
  name?: string | null
  success?: boolean | null
}

/** One task node in a sealed plan (e.g. `stack-0`): its stages + rollup. */
export interface PlanNode {
  success?: boolean | null
  stages?: Stage[] | null
}

/** One sealed `task.plan_complete` row: a task run's goal, tree, and tallies. */
export interface PlanComplete {
  goal?: string | null
  success?: boolean | null
  replans?: number | null
  actuations?: number | null
  faults?: unknown[] | null
  nodes?: Record<string, PlanNode> | null
}

/** One `capability.resolve` row: which provider served a capability seam. */
export interface CapabilityResolve {
  capability?: string | null
  consumer?: string | null
  privileged?: boolean | null
  ref?: string | null
}

/** The newest `runtime.boot` row: MODE + the mount seal. */
export interface BootRow {
  mode?: string | null
  mount_plan_sha?: string | null
  skills_manifest?: unknown[] | null
}

/** One rejected-brief row (a fault class distinct from a node failure). */
export interface TaskError {
  brief?: string | null
  task?: string | null
  error?: string | null
}

/** `session({name})`: note payloads grouped by kind + chain badges. */
export interface SessionDetail {
  name?: string
  mtime?: number | null
  chain_ok?: boolean
  kinds?: Record<string, number>
  rows?: {
    'task.plan_complete'?: PlanComplete[]
    'capability.resolve'?: CapabilityResolve[]
    'runtime.boot'?: BootRow[]
    'runtime.task_error'?: TaskError[]
  }
  error?: string
}

/** `sessions()` summary card (no row payloads). */
export interface SessionSummary {
  name?: string
  mtime?: number | null
  chain_ok?: boolean
  kinds?: Record<string, number>
}

/** `sessionProgress({name})`: the Python-side mission-progress fold. */
export interface SessionProgress {
  name?: string
  tasks?: number
  succeeded?: number
  failed?: number
  replans?: number
  faults?: number
  task_errors?: number
  stages?: number
  stages_passed?: number
  stage_pass_rate?: number | null
  latest?: PlanComplete | null
}

/** `runtimeStatus({name})`: the live status file, or null when absent. */
export interface RuntimeStatus {
  pid?: number | null
  render?: unknown
  mode?: string | null
}
