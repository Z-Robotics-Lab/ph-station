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

/** One task node of a seed's plan, as scripts/evolve.py's `nodes` writes it:
 * `ok` null = not run yet. */
export interface NodeRow {
  id?: string
  skill?: string
  ok?: boolean | null
  steps?: number | null
  failure_mode?: string | null
  /** Ids this node runs after (the plan's edges); absent on trails written before edges existed. */
  after?: string[] | null
  /** The plan's node kind ('task' | 'recovery' | ...); recovery nodes draw dashed. */
  kind?: string | null
}

/** One seed of the kept suite, as scripts/evolve.py's `per_seed` writes it. */
export interface SeedRow {
  seed?: number
  success?: boolean | null
  first_death?: string | null
  failure_mode?: string | null
  /** Per-node verdicts in plan order; absent on rows written before nodes existed. */
  nodes?: NodeRow[] | null
  elapsed_s?: number | null
  /** Execution-owned verifier evidence, retained verbatim for inspection. */
  evaluation?: unknown
  verification_observations?: unknown[] | null
  terminal_observation?: unknown
}

/** The per-round rates board/store.py derives off the seeds' nodes for
 * `rsiSeries` (not stored in campaign.json): `node_rate` = mean ok-nodes/nodes
 * over seeds (0..1, null on rounds without nodes), `by_task` = the pass
 * fraction of each plan task (every node carrying that `task` ok), {} when none. */
export interface RoundRates {
  node_rate?: { before?: number | null; after?: number | null; best?: number | null } | null
  by_task?: Record<string, { before?: number | null; after?: number | null }> | null
}

/** Backend evaluation of the same fixed task obligations on a seed suite. */
export interface EvaluationSample {
  successes?: number | null
  episodes?: number | null
  progress?: number | null
  obligations?: number | null
}

/** Development acceptance and installation are independent recorded decisions. */
export interface RoundEvaluation {
  protocol_id?: string
  objective_id?: string
  before?: EvaluationSample | null
  after?: EvaluationSample | null
  acceptance?: { accepted?: boolean | null; reason?: string | null } | null
  installation?: { status?: string | null; reason?: string | null } | null
}

/** Recorded resource consumption; null means unmeasured, including incomplete token usage. */
export interface ResourceCost {
  episode_attempts: number | null
  model_calls: number | null
  input_bytes: number | null
  llm_tokens: number | null
  sim_s: number | null
  wall_s: number | null
}

/** Backend transfer measurement and resource costs within one development epoch. */
export interface TransferEvidence {
  prior_tasks?: number | null
  first_accepted_round?: number | null
  total_trials?: number | null
  censored?: boolean | null
  condition?: string | null
  memory_prefix?: number | null
  claim?: string | null
  accepted_updates?: number
  cost?: {
    total: ResourceCost
    /** Null means no first acceptance; a present record can contain unknown costs. */
    first_accepted: ResourceCost | null
    /** Since the acceptance preceding this round, including the current round. */
    since_previous_acceptance: ResourceCost
  }
}

/** Backend identities of the program policies compared and retained by a round. */
export interface PolicyRevision {
  before_id?: string | null
  candidate_id?: string | null
  active_id?: string | null
  parent_id?: string | null
  updated?: boolean | null
  representation?: string | null
}

/** Backend counters for a submitted brief or a single learning cycle. */
export interface RunBudget {
  scope?: string | null
  cycle?: number
  /** Explicit null total caps denote an uncapped continuous brief; absent caps are unknown. */
  limits?: {
    model_calls?: number | null
    input_bytes?: number | null
    output_tokens_per_call?: number | null
    probe_episodes?: number | null
  } | null
  used?: {
    model_calls?: number | null
    input_bytes?: number | null
    probe_episodes?: number | null
    full_evaluations?: number | null
  } | null
}

/** One round of an evolve campaign (`campaign.json` rounds[]). */
export interface CampaignRound {
  round?: number
  tried?: { kind?: string; node?: string; detail?: unknown } | null
  /** Recorded source: LLM, explicit proposal inbox, or historical rules. New runs use LLM only. */
  proposer?: string | null
  /** Backend model audit. Status distinguishes a proposal, abstention, validation rejection, and provider failure. */
  llm?: {
    method?: string | null
    calls?: number | null
    evidence_reads?: number | null
    evidence_refs?: unknown[]
    trial_calls?: number | null
    usage_complete?: boolean
    budget?: {
      limits?: {
        max_calls?: number | null
        max_request_bytes?: number | null
        max_input_bytes?: number | null
        max_tool_bytes?: number | null
        max_read_calls?: number | null
        max_output_tokens?: number | null
      } | null
      used?: { calls?: number | null; input_bytes?: number | null; tool_bytes?: number | null; output_tokens?: number | null } | null
      usage_complete?: boolean
    } | null
    stop_reason?: string | null
    status?: string | null
    summary?: string | null
    rationale?: string | null
    reason?: string | null
    model?: string | null
    requested_model?: string | null
    effort?: string | null
    prompt_sha?: string | null
    error?: { type?: string | null; message?: string | null; stage?: string | null } | null
    [key: string]: unknown
  } | null
  before?: number
  after?: number | null
  best?: number
  suite_sha?: string | null
  published?: boolean
  accepted?: boolean | null
  evaluation?: RoundEvaluation | null
  /** Backend diagnosis and memory records are shown verbatim, without frontend inference. */
  diagnosis?: { status?: string; findings?: Array<{ kind?: string; channel?: string; evidence?: unknown }>; [key: string]: unknown } | null
  experience?: { retrieved?: unknown[]; recorded?: unknown; [key: string]: unknown } | null
  transfer?: TransferEvidence | null
  policy?: PolicyRevision | null
  run_budget?: RunBudget | null
  cycle_budget?: RunBudget | null
  cycle_outcome?: string | null
  stop_reason?: string | null
  /** Exploratory probes are not the paired acceptance trial. Full rounds only. */
  learning?: { method?: string; probes?: unknown[]; selected_policy_id?: string | null; [key: string]: unknown } | null
  per_seed?: SeedRow[] | null
  /** The retest rows of the trial (same seeds as `per_seed`); absent when nothing was tried. */
  after_seeds?: SeedRow[] | null
  /** What would unblock a round that tried nothing (non-empty only for kind none). */
  needs?: string[] | null
  media?: string[]
  /** `"<seed>/<node>"` → `{reason, keyframes}` of the segments that left no clip (a bare reason on older rows). */
  media_dropped?: Record<string, string | DroppedNode> | null
  /** The round this try started from (the last accepted state; 0 = the initial baseline). */
  parent?: number | null
  /** 'improved' | 'same' | 'worse' | 'none' (tried nothing) | 'error' (model call failed). */
  outcome?: string | null
  /** Additional development-seed pass, when one ran: its seeds and k-of-n before / after. */
  confirm?: { seeds?: number[] | null; before?: number | null; after?: number | null } | null
  usage?: Usage | null
  ts?: number
}

/** What one round (or a whole campaign, summed) spent. */
export interface Usage {
  llm_tokens?: { prompt?: number | null; completion?: number | null; cache_hit?: number | null } | null
  sim_s?: number | null
}

/** A dropped segment: why, and the failure keyframe stills it left (session-relative). */
export interface DroppedNode { reason?: string | null; keyframes?: string[] | null }

/** `rsiFrames({name, task, round})`: the kept media paths plus, per dropped
 * `"<seed>/<node>"`, its reason and keyframe stills; a bare path list on rows
 * written before keyframes existed. All paths session-relative. */
export type FramesPayload = string[] | { media?: string[] | null; dropped?: Record<string, DroppedNode> | null } | null

/** The in-flight round, as scripts/evolve.py rewrites campaign.json's `live`
 * between checkpoints; null on a campaign written before live progress existed. */
export interface LiveState {
  /** Evaluation phase, backoff between cycles, or terminal/idle state. */
  phase?: string
  cycle?: number
  retry_at?: number | null
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
  /** The running seed's plan nodes, in order; the first `ok: null` is the one executing. */
  nodes?: NodeRow[] | null
  seed_started_at?: number
  /** The runtime's recent progress lines, oldest first. */
  messages?: Array<{ ts?: number; text?: string }> | null
}

/** `rsiRun({session, task})`: the campaign.json header, `latest` (the newest
 * COMPACT round row or null) and a BOUNDED `rounds` — the last 20 rounds in the
 * compact {@link SeriesPoint} shape. `rsiRun({session, task, round})` swaps
 * `rounds` for that ONE round in full (per-seed trails, media, llm, needs). */
export interface Campaign {
  /** Request configuration recorded by the runtime; absent on historical campaigns. */
  llm_config?: { model: string | null; effort: string } | null
  task?: string
  session?: string
  seeds?: [number, number]
  arm?: string
  rounds?: CampaignRound[]
  best?: number
  cursor?: number
  /** 'running' | 'cancelled' | 'done' | 'failed' (campaign.json's word, shown verbatim). */
  status?: string
  latest?: CampaignRound | null
  live?: LiveState | null
  /** The intake filename of the evolve brief still driving this task, or null. */
  open_brief?: string | null
  transfer?: TransferEvidence | null
  run_budget?: RunBudget | null
  cycle_budget?: RunBudget | null
  continuous?: boolean
  stop_reason?: string | null
  /** The accepted card copy every new round starts from: its round (0 = the stock card). */
  incumbent?: { round?: number; workspace?: string | null } | null
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
  /** The series' running-max node pass rate (0..1), null before any round carried nodes. */
  node_rate_best?: number | null
  /** campaign.json mtime, epoch seconds. */
  updated?: number
  live?: { phase?: string | null; message?: string | null } | null
  open_brief?: string | null
  published_rounds?: number
  /** Summed over the rounds. */
  usage?: Usage | null
}

/** `rsiSeries({session, task})`: one COMPACT point per round — the line-chart,
 * heat-strip and hypothesis-tree feed. Scalars only: per-seed trails, traces and
 * evidence never ride this face at any campaign length (they made it 11 MB on a
 * 490-round campaign); `rsiRun({round})` serves them one round at a time. */
export interface SeriesPoint extends RoundRates {
  round?: number
  before?: number
  after?: number | null
  best?: number
  parent?: number | null
  proposer?: string | null
  outcome?: string | null
  accepted?: boolean | null
  published?: boolean | null
  evaluation?: RoundEvaluation | null
  policy?: PolicyRevision | null
  run_budget?: RunBudget | null
  cycle_budget?: RunBudget | null
  cycle_outcome?: string | null
  stop_reason?: string | null
  llm?: CampaignRound['llm']
  usage?: Usage | null
  tried?: CampaignRound['tried']
}

/** Model discovery and request defaults owned by the harness provider. */
export interface RsiModelOptions {
  default_model: string | null
  default_effort: string
  models: { id: string }[]
  efforts: string[]
  error?: string
}
