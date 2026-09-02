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
  /** runtime mode from runtime_status.json: 'execution' | 'evolution' | null before the first boot */
  mode?: string | null
  runtime_alive?: boolean
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

/** `policyServer(action)`: the pi0.5 policy server process (port 8000).
 * `running` without `serving` is its load window; `checkpoint_sha` names the
 * weights it serves. `error` reports a refused or failed action. */
export interface PolicyServerState {
  running?: boolean
  pid?: number | null
  port?: number
  serving?: boolean
  checkpoint_sha?: string | null
  error?: string
}

/** `health()`: the rail reads only the `restart` row — the last restart
 * helper's `{state, last}` — once the console answers again. */
export interface Health {
  ok?: boolean
  restart?: { state?: string | null; last?: string | null }
}

/** One line of the operational event feed (harness.opstream): its sequence and
 * kind are all the rail reads — `task_claimed` opens a run, `task_done` /
 * `task_failed` seal it (the board's terminal markers, read verbatim). */
export interface RuntimeEvent {
  seq?: number
  kind?: string
  /** The brief this line belongs to (opstream's `brief=` detail) — the evolve
   * page filters its log by it; `task` is what task_claimed names. */
  brief?: string
  task?: string
  ts?: number
  /** rsi_step rows name their round; task_failed carries the runtime's error. */
  round?: number
  error?: string
  message?: string
}

/** `runtimeEvents({name})`: events past the cursor plus the newest seq. */
export interface RuntimeEventsPayload {
  events?: RuntimeEvent[]
  last_seq?: number
}

/** One `skills({name})` row: a record's overview (Python `board.store.skills`).
 * `bindings` maps embodiment → executor keys; `evidence` maps embodiment →
 * `{n, k, by_executor: {key: {n, k}}}` (n tries, k successes), shown verbatim. */
export interface SkillEvidence {
  n?: number
  k?: number
  by_executor?: Record<string, { n?: number; k?: number }>
}
export interface SkillRow {
  name?: string
  bindings?: Record<string, string[]>
  evidence?: Record<string, SkillEvidence>
  limits?: Record<string, unknown> | null
  failure_modes?: string[]
}

/** One seed of the kept suite, as scripts/evolve.py's `per_seed` writes it. */
export interface SeedRow {
  seed?: number
  success?: boolean | null
  first_death?: string | null
  failure_mode?: string | null
}

/** One round of an evolve campaign (`campaign.json` rounds[]). */
export interface CampaignRound {
  round?: number
  tried?: { kind?: string; node?: string; detail?: unknown } | null
  before?: number
  after?: number
  best?: number
  suite_sha?: string
  published?: boolean
  per_seed?: SeedRow[] | null
  /** What would unblock a round that tried nothing (non-empty only for kind none). */
  needs?: string[] | null
  media?: string[]
  /** `"<seed>/<node>": reason` of the segments that left no clip. */
  media_dropped?: Record<string, string> | null
  ts?: number
}

/** The in-flight round, as scripts/evolve.py rewrites campaign.json's `live`
 * between checkpoints; null on a campaign written before live progress existed. */
export interface LiveState {
  /** 'baseline' | 'propose' | 'retest' | 'publish' | 'done' | 'cancelled' | 'idle' */
  phase?: string
  round?: number
  seeds_total?: number
  seed_index?: number
  seed?: number | null
  node?: string | null
  started_at?: number
  round_started_at?: number
  phase_started_at?: number
  /** Wall seconds of the previous round; null on the first. */
  last_round_s?: number | null
  per_seed_partial?: SeedRow[] | null
  tried?: CampaignRound['tried']
  message?: string | null
}

/** `rsiRun({name, task})`: campaign.json plus `latest` (newest round or null). */
export interface Campaign {
  task?: string
  session?: string
  seeds?: [number, number]
  arm?: string
  rounds?: CampaignRound[]
  best?: number
  cursor?: number
  /** 'running' | 'cancelled' | 'done' (campaign.json's word, shown verbatim). */
  status?: string
  latest?: CampaignRound | null
  live?: LiveState | null
  /** The intake filename of the evolve brief still driving this task, or null. */
  open_brief?: string | null
}

/** One `rsiCampaigns({name})` row: a campaign's headline off its campaign.json
 * (so the list survives a restart), running first then newest `updated` first. */
export interface CampaignSummary {
  task?: string
  status?: string
  cursor?: number
  /** Finished-round count. */
  rounds?: number
  best?: number
  seeds?: [number, number]
  arm?: string
  /** campaign.json mtime, epoch seconds. */
  updated?: number
  live?: { phase?: string | null; message?: string | null } | null
  open_brief?: string | null
}

/** `rsiSeries({name, task})`: one point per round, the line-chart feed. */
export interface SeriesPoint {
  round?: number
  before?: number
  after?: number
  best?: number
}
