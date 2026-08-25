/**
 * Fork host bridge: the ph-station read panels reach the harness's evidence
 * layer (board/store.py) through its CLI face (board/storecli.py), same-origin
 * behind the gateway's trusted-host fence.
 *
 * The charter's "MCP 与 CLI 是同一函数的两个调用面": the MCP server serves the
 * chat LLM; this Remote serves the panels. Every method execFiles storecli and
 * forwards its stdout JSON verbatim -- zero statistics, zero interpretation, so
 * a panel renders the byte-identical dict the LLM gets. `execFile` (not a shell)
 * plus the fixed fn per method (never user input) plus storecli's own
 * `safe_child` guard on the name argument leave no injection surface.
 *
 * @module @deepseek-ai/dsh-ph-board
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { JsonValue } from '@deepseek-ai/dsh-session/types'
// The Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  BoardRuntimeEventsRequest, BoardSessionRequest, BoardStoreRequest,
  BoardVaultNeighborsRequest, BoardVaultNodeRequest,
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
 * Read-only Remote over board.store via the storecli subprocess. The gateway
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

  /**
   * @param ctx - owning Cordis Context.
   * @param config - box-specific spawn paths.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'board')
    this.config = config
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
   * One runtime session's LIVE viewport frame (`runs/<session>/frame.jpg`,
   * dumped offscreen by the harness frames overlay while a task runs):
   * `{jpeg_b64, ts, age_s}`, or `{error: 'no frame'}` when none exists. The
   * base64 is encoded harness-side; this panel-facing face only forwards it.
   * @param request - the session name (guarded by storecli's safe_child).
   * @returns board.store.read_runtime_frame(...) verbatim, or an {error} dict.
   */
  @Remote('runtimeFrame')
  runtimeFrame(request: BoardSessionRequest): Promise<JsonValue> {
    return this.run('runtime_frame', request.name)
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
