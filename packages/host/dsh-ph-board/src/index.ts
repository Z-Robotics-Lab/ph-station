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
import type { BoardStoreRequest } from './types.ts'

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

  /** Spawn the harness CLI face and forward its stdout JSON verbatim. */
  private async run(fn: string, name?: string): Promise<JsonValue> {
    const args = ['-m', 'board.storecli', fn]
    if (name !== undefined) args.push(name)
    args.push('--runs', this.config.runsDir)
    const { stdout } = await execFileAsync(this.config.pythonPath, args, { cwd: this.config.repoRoot })
    return JSON.parse(stdout) as JsonValue
  }
}

export default BoardBridge
