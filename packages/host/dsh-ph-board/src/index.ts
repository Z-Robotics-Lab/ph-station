/**
 * Fork host bridge: the ph-station read panels reach the harness's evidence
 * layer (board/store.py) through its CLI face (board/storecli.py), same-origin
 * behind the gateway's trusted-host fence.
 *
 * The charter's "MCP 与 CLI 是同一函数的两个调用面": the MCP server serves the
 * chat LLM; this Remote serves the panels. Every method execFiles storecli and
 * forwards its stdout JSON verbatim -- zero statistics, zero interpretation, so
 * a panel renders the byte-identical dict the LLM gets. (`runtimeFrame` alone
 * rides a resident `storecli serve` worker over line-JSON stdio -- the same
 * dispatch and the same dicts, just without the per-frame interpreter spawn.)
 * `execFile`/`spawn` (not a shell) plus the fixed fn per method (never user
 * input) plus storecli's own `safe_child` guard on the name argument leave no
 * injection surface. `submitBrief` is the one write: the same storecli face's
 * atomic brief drop, forwarded with zero client-side validation because the
 * resident runtime is the only authority over what a brief means.
 *
 * @module @deepseek-ai/dsh-ph-board
 */

import { execFile, spawn } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import type { ChildProcessByStdio } from 'node:child_process'
import { createInterface } from 'node:readline'
import { promisify } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { JsonValue } from '@deepseek-ai/dsh-session/types'
// The Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  BoardRuntimeEventsRequest, BoardRuntimeFrameRequest, BoardRuntimeKeyframeRequest,
  BoardSessionRequest, BoardStoreRequest, BoardVaultNeighborsRequest, BoardVaultNodeRequest,
} from './types.ts'

export type * from './types.ts'

const execFileAsync = promisify(execFile)

/**
 * Box-specific spawn paths (dsh: no hardcoded tunables). The cockpit exports
 * them as PH_BOARD_* env vars; the deploy overlay's bundle row reads those,
 * and disables this plugin when they are absent so a plain `dsh web` still boots.
 */
export interface Config {
  /** Python that imports board.store -- the motherboard repo venv. */
  readonly pythonPath: string
  /** Motherboard checkout run as storecli's cwd (it inserts itself on sys.path). */
  readonly repoRoot: string
  /** Campaign runs/ directory storecli reads (passed as --runs). */
  readonly runsDir: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    board: BoardBridge
  }
}

/**
 * Remote over board.store via the storecli subprocess: read methods plus the
 * one write (`submitBrief`, storecli's atomic brief drop). The gateway
 * auto-serves each @Remote method at POST /api/board/<name>.
 */
export class BoardBridge extends TypertRemoteService {
  /** Loader validation for the three deployment-varying paths. */
  static Config: s<Config> = s.object({
    pythonPath: s.string().required(),
    repoRoot: s.string().required(),
    runsDir: s.string().required(),
  })

  private readonly config: Config

  /** Resident `storecli serve` child for the 取景窗 long poll, spawned lazily
   * by {@link runtimeFrame} (every other method keeps one-shot execFile). The
   * per-request interpreter+import spawn (~60ms) was the measured browser fps
   * ceiling; the worker answers over line-JSON stdio with replies strictly in
   * request order, so a FIFO of pending settlers pairs them. Any exit or error
   * rejects the backlog and nulls the field; the next call respawns. */
  private frameWorker: ChildProcessByStdio<Writable, Readable, null> | null = null

  /** Pending {@link runtimeFrame} settlers, oldest first (one per request line
   * written to {@link frameWorker}; the worker replies in the same order). */
  private framePending: Array<{ resolve: (v: JsonValue) => void; reject: (e: Error) => void }> = []

  /**
   * @param ctx - owning Cordis Context.
   * @param config - box-specific spawn paths.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'board')
    this.config = config
    ctx.effect(() => () => { this.frameWorkerDown(new Error('board bridge disposed')) },
      'ph-board: frame worker reaper')
  }

  /**
   * Every campaign store under runs/, newest first (summary cards).
   * @returns board.store.list_stores(runs) verbatim.
   */
  @Remote('stores')
  stores(): Promise<JsonValue> {
    return this.run('list_stores')
  }

  /**
   * Full structured view of one campaign store by name.
   * @param request - the store name (guarded by storecli's safe_child).
   * @returns board.store.store_detail(...) verbatim, or an {error} dict.
   */
  @Remote('store')
  store(request: BoardStoreRequest): Promise<JsonValue> {
    return this.run('store', request.name)
  }

  /**
   * Multi-block held-out comparison for a campaign (its block + rescores).
   * @param request - the store name (guarded by storecli's safe_child).
   * @returns board.store.heldout_blocks(...) verbatim, or an {error} dict.
   */
  @Remote('heldout')
  heldout(request: BoardStoreRequest): Promise<JsonValue> {
    return this.run('heldout', request.name)
  }

  /**
   * Every installed 机箱 card (each plugin's `manifest.toml`), manifest read as data.
   * @returns board.cards.list_cards() verbatim.
   */
  @Remote('cards')
  cards(): Promise<JsonValue> {
    return this.run('cards')
  }

  /**
   * The progress.md rounds feed (`## Round N - DATE - TITLE` sections), latest first.
   * @returns board.store.parse_rounds(...) verbatim (演进 timeline).
   */
  @Remote('rounds')
  rounds(): Promise<JsonValue> {
    return this.run('rounds')
  }

  /**
   * The STATUS.md seed-block ledger (each range's burn state + source line).
   * @returns board.store.parse_ledger(...) verbatim (账本 table).
   */
  @Remote('ledger')
  ledger(): Promise<JsonValue> {
    return this.run('ledger')
  }

  /**
   * Every live campaign heartbeat under runs/ (`runs/<store>/progress.json`, written
   * per finished episode by script-path batteries): done/total/label, the
   * python-folded rolling stats, and a `running` flag (fresh heartbeat, not yet
   * at total). Live state, never sealed evidence -- the 演进 panel's
   * in-progress card renders it verbatim.
   * @returns board.store.campaign_progress(runs) verbatim.
   */
  @Remote('campaignProgress')
  campaignProgress(): Promise<JsonValue> {
    return this.run('campaign_progress')
  }

  /**
   * Every runtime session under runs/, newest first (summary cards, no rows).
   * @returns board.store.discover_sessions(runs) verbatim (status-bar heartbeat).
   */
  @Remote('sessions')
  sessions(): Promise<JsonValue> {
    return this.run('sessions')
  }

  /**
   * One runtime session by name: its note payloads grouped by kind + chain check.
   * @param request - the session name (guarded by storecli's safe_child).
   * @returns board.store.read_session(...) verbatim, or an {error} dict.
   */
  @Remote('session')
  session(request: BoardSessionRequest): Promise<JsonValue> {
    return this.run('session', request.name)
  }

  /**
   * One session's mission-progress aggregate over its task.plan_complete rows
   * (task tallies, total replans/faults, stage pass-rate, latest task tree).
   * The fold lives in Python (charter: statistics in board/); this forwards it.
   * @param request - the session name (guarded by storecli's safe_child).
   * @returns board.store.session_progress(...) verbatim, or an {error} dict.
   */
  @Remote('sessionProgress')
  sessionProgress(request: BoardSessionRequest): Promise<JsonValue> {
    return this.run('session_progress', request.name)
  }

  /**
   * One runtime session's LIVE status (pid/render/mode/boot_ts/display),
   * overwritten each boot. Live operational state, not the sealed boot-row seal.
   * @param request - the session name (guarded by storecli's safe_child).
   * @returns board.store.read_runtime_status(...) verbatim, or null when absent.
   */
  @Remote('runtimeStatus')
  runtimeStatus(request: BoardSessionRequest): Promise<JsonValue> {
    return this.run('runtime_status', request.name)
  }

  /**
   * The harness box's LIVE resource headroom: every GPU's VRAM with the compute
   * processes holding it (biggest first), physical RAM, and free space on the
   * filesystem holding `runs/` — `{gpu, ram, disk, ts}`. Host-addressed rather
   * than session-addressed, so it takes no argument. Live state, never chain
   * evidence, and the harness face never raises: a box with no NVIDIA driver
   * reports an empty `gpu` list instead of an error.
   * @returns board.store.host_vitals(runsDir) verbatim.
   */
  @Remote('hostVitals')
  hostVitals(): Promise<JsonValue> {
    return this.run('host_vitals')
  }

  /**
   * One runtime session's LIVE viewport frame (`runs/<session>/frame.jpg`,
   * dumped offscreen by the harness frames overlay while a task runs):
   * `{jpeg_b64, ts, age_s}`, or `{error: 'no frame'}` when none exists. The
   * base64 is encoded harness-side; this panel-facing face only forwards it.
   * `afterTs` is the poller's cursor: an unchanged file returns the short
   * `{unchanged, ts, age_s}` reply with no image bytes. `waitMs` long-polls:
   * storecli blocks up to that long (capped board-side at 2s) for the frame to
   * change past the cursor before answering, so the 取景窗 re-issues the call
   * on reply and its to-hand fps tracks the writer's dump rate.
   * @param request - session name (guarded by storecli's safe_child) + cursors.
   * @returns board.store.read_runtime_frame(...) verbatim, or an {error} dict.
   */
  @Remote('runtimeFrame')
  runtimeFrame(request: BoardRuntimeFrameRequest): Promise<JsonValue> {
    const ts = request.afterTs ?? 0
    const wait = Math.trunc(request.waitMs ?? 0)
    const line = JSON.stringify({
      fn: 'runtime_frame',
      name: request.name,
      after_ts: Number.isFinite(ts) && ts > 0 ? ts : 0,
      wait_ms: Number.isFinite(wait) && wait > 0 ? wait : 0,
    })
    return new Promise<JsonValue>((resolve, reject) => {
      const child = this.frameWorkerUp()
      // Wedge guard: the reply must land within the long-poll budget (storecli
      // caps the wait at 2s) plus slack; a silent worker is killed, which
      // rejects the backlog through its exit handler and forces a respawn.
      const budget = setTimeout(() => { child.kill() }, Math.max(wait, 2000) + 3000)
      this.framePending.push({
        resolve: (v) => { clearTimeout(budget); resolve(v) },
        reject: (e) => { clearTimeout(budget); reject(e) },
      })
      child.stdin.write(`${line}\n`, (err) => { if (err !== null && err !== undefined) child.kill() })
    })
  }

  /** The live worker, spawning it if none is up. */
  private frameWorkerUp(): ChildProcessByStdio<Writable, Readable, null> {
    if (this.frameWorker !== null) return this.frameWorker
    const child = spawn(this.config.pythonPath, ['-m', 'board.storecli', 'serve', '--runs', this.config.runsDir],
      { cwd: this.config.repoRoot, stdio: ['pipe', 'pipe', 'ignore'] })
    createInterface({ input: child.stdout }).on('line', (reply) => {
      const p = this.framePending.shift()
      if (p === undefined) return
      try { p.resolve(JSON.parse(reply) as JsonValue) } catch (e) { p.reject(e as Error) }
    })
    const down = () => {
      if (this.frameWorker === child) this.frameWorker = null
      this.frameWorkerDown(new Error('storecli serve worker exited'))
    }
    child.on('error', down)
    child.on('exit', down)
    this.frameWorker = child
    return child
  }

  /** Kill the worker (if any) and reject every pending frame settler. */
  private frameWorkerDown(err: Error): void {
    const child = this.frameWorker
    this.frameWorker = null
    if (child !== null) child.kill()
    const backlog = this.framePending
    this.framePending = []
    for (const p of backlog) p.reject(err)
  }

  /**
   * One runtime session's OPERATIONAL event feed (runtime_events.jsonl, written
   * by harness.opstream): events with seq > afterSeq plus last_seq. A last_seq
   * below the caller's cursor means the runtime re-booted (feed truncated);
   * the poller resets its cursor to 0 and re-reads. Live progress, never chain
   * evidence.
   * @param request - session name (guarded by storecli's safe_child) + cursor.
   * @returns board.store.read_runtime_events(...) verbatim, or an {error} dict.
   */
  @Remote('runtimeEvents')
  runtimeEvents(request: BoardRuntimeEventsRequest): Promise<JsonValue> {
    const after = Math.trunc(request.afterSeq ?? 0)
    return this.run('runtime_events', request.name,
      ['--after', String(Number.isFinite(after) && after > 0 ? after : 0)])
  }

  /**
   * The INDEX of one runtime session's keyframe stills (`runs/<session>/keyframes/`,
   * one JPEG the harness pins to an interesting `runtimeEvents` seq and clears on
   * every boot): `{frames: [{seq, kind, ts}], count}`. Index only — no image
   * bytes — so a panel polls it at event cadence and fetches a still through
   * {@link runtimeKeyframe} on demand. An absent directory reads as an empty
   * index, because a keyframe is live state and never sealed evidence.
   * @param request - the session name (guarded by storecli's safe_child).
   * @returns board.store.read_runtime_keyframes(...) verbatim, or an {error} dict.
   */
  @Remote('runtimeKeyframes')
  runtimeKeyframes(request: BoardSessionRequest): Promise<JsonValue> {
    return this.run('runtime_keyframes', request.name)
  }

  /**
   * One keyframe still by the `runtimeEvents` seq it is pinned to:
   * `{jpeg_b64, seq, kind}`, or `{error: 'no keyframe'}` when that seq holds
   * none (never captured, or cleared by a later boot). The base64 is encoded
   * harness-side; this face only forwards it.
   * @param request - session name (guarded by storecli's safe_child) + the seq.
   * @returns board.store.read_runtime_keyframe(...) verbatim, or an {error} dict.
   */
  @Remote('runtimeKeyframe')
  runtimeKeyframe(request: BoardRuntimeKeyframeRequest): Promise<JsonValue> {
    const seq = Math.trunc(request.seq)
    return this.run('runtime_keyframe', request.name,
      ['--seq', String(Number.isFinite(seq) && seq > 0 ? seq : 0)])
  }

  /**
   * Drop one brief into a runtime session's inbox (`storecli submit_brief`,
   * which shares board/brief_drop's atomic write with mcp_server.submit_brief).
   * The one write on this Remote, and deliberately zero-validation on both
   * sides: the resident runtime is the sole authority over what a brief means,
   * so a malformed brief is filed under the session's failed/ by the runtime
   * rather than second-guessed here.
   * @param briefJson - the brief as a JSON string, forwarded verbatim as --brief.
   * @param session - runtime session directory name, forwarded as --session.
   * @returns storecli's stdout verbatim ({submitted, inbox}, the same JSON
   * mcp_server.submit_brief returns), or an {error} dict.
   */
  @Remote('submitBrief')
  submitBrief(briefJson: string, session: string): Promise<JsonValue> {
    return this.run('submit_brief', undefined, ['--brief', briefJson, '--session', session])
  }

  /**
   * The whole skill vault: the deterministic fold over sealed SkillRecords,
   * manifest cards, and the capability catalog as a typed wiki graph.
   * @returns board.vault.build_graph(...) verbatim ({schema_version, nodes, edges}).
   */
  @Remote('vault')
  vault(): Promise<JsonValue> {
    return this.run('vault')
  }

  /**
   * One vault node as a wiki page: the node plus its `out` edges and `backlinks`.
   * @param request - the node id (skill digest / package dir / capability seam).
   * @returns board.vault.node(...) verbatim, or an {error: 'unknown node'} dict.
   */
  @Remote('vaultNode')
  vaultNode(request: BoardVaultNodeRequest): Promise<JsonValue> {
    return this.run('vault_node', request.id)
  }

  /**
   * Adjacency (both directions) for one vault node, optionally one relation.
   * @param request - the node id plus an optional `rel` restriction.
   * @returns board.vault.neighbors(...) verbatim, or an {error: 'unknown node'} dict.
   */
  @Remote('vaultNeighbors')
  vaultNeighbors(request: BoardVaultNeighborsRequest): Promise<JsonValue> {
    const extra = request.relation === undefined ? [] : ['--relation', request.relation]
    return this.run('vault_neighbors', request.id, extra)
  }

  /** Spawn the harness CLI face and forward its stdout JSON verbatim. */
  private async run(fn: string, name?: string, extraArgs: readonly string[] = []): Promise<JsonValue> {
    const args = ['-m', 'board.storecli', fn]
    if (name !== undefined) args.push(name)
    args.push('--runs', this.config.runsDir, ...extraArgs)
    const { stdout } = await execFileAsync(this.config.pythonPath, args, { cwd: this.config.repoRoot })
    return JSON.parse(stdout) as JsonValue
  }
}

export default BoardBridge
