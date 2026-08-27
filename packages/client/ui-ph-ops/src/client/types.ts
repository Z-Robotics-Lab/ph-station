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

/** One compute process holding VRAM on a card, as `nvidia-smi` names it. */
export interface GpuProc {
  pid?: number
  name?: string
  used_mib?: number
}

/** One GPU's VRAM, with the processes holding it already ranked biggest-first
 * by the board (the rail names the top consumer; it sorts nothing). */
export interface GpuVitals {
  index?: number
  name?: string
  used_mib?: number
  total_mib?: number
  procs?: GpuProc[]
}

/** `hostVitals()`: the harness box's live resource headroom. `gpu` is empty on a
 * host with no NVIDIA driver — a normal deployment, never an error. */
export interface HostVitals {
  gpu?: GpuVitals[]
  ram?: { used_gb?: number; total_gb?: number }
  disk?: { path?: string; free_gb?: number; total_gb?: number }
  ts?: number
}

/** `modelServer(action)`: the box's local model server process. `running` with
 * `healthy` false is the 1-2 minute load window — the server holds its port long
 * before it answers. `error` reports a refused or failed action beside a status
 * that stays truthful. `vram_mib` is this server's own row out of
 * {@link HostVitals}, so it matches the VRAM meter directly above it. */
export interface ModelServerState {
  running?: boolean
  pid?: number | null
  port?: number
  healthy?: boolean
  model?: string | null
  vram_mib?: number | null
  error?: string
}

/** One line of the operational event feed (harness.opstream): its sequence and
 * kind are all the rail reads — `task_claimed` opens a run, `task_done` /
 * `task_failed` seal it (the board's terminal markers, read verbatim). */
export interface RuntimeEvent {
  seq?: number
  kind?: string
}

/** `runtimeEvents({name})`: events past the cursor plus the newest seq. */
export interface RuntimeEventsPayload {
  events?: RuntimeEvent[]
  last_seq?: number
}
