/**
 * The VLM brain: an LLM planner that turns a mission into an ordered plan of
 * skills drawn from the harness skill index, choosing each executor by measured
 * success rate. It is a Remote (POST /api/brain/plan), so the cockpit's brain
 * panel reaches it over the same gateway seam every other panel uses, and it
 * dispatches nothing itself — the panel drives the loop through `ctx.board`
 * (submit_brief → brief_status), the one execution door the harness exposes.
 *
 * At session start the runtime boot writes the skill index to
 * `<runsDir>/<session>/skill_index.json` (scripts/harness_runtime.py). This
 * plugin reads that one file as the planner's context, calls DeepSeek's
 * OpenAI-compatible `/chat/completions` once per turn with the API key resolved
 * from the credentials seam (never held here, never logged), and returns the
 * parsed plan. The planning rule and reply parsing live in
 * {@link module:@deepseek-ai/dsh-ph-brain/planner} so they are testable without
 * a network or a key.
 *
 * @module @deepseek-ai/dsh-ph-brain
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { JsonValue } from '@deepseek-ai/dsh-session/types'
// The Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
// Type-only: pulls the credentials service merge (ctx.get('credentials')).
import type {} from '@deepseek-ai/dsh-credentials/types'
import { buildMessages, parsePlan } from './planner.ts'
import type { BrainPlan, SkillIndex } from './types.ts'

export type * from './types.ts'

/** Public DeepSeek endpoint; the internal one comes from $DEEPSEEK_BASE_URL. */
const PUBLIC_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY'
const DEFAULT_TIMEOUT_MS = 60_000

/**
 * Box-specific config. `runsDir` and `model` are deployment facts (no default);
 * the credential reference and endpoint default to DeepSeek's public API so the
 * cockpit overlay only has to name the model. The cockpit disables this row
 * without `PH_BOARD_RUNS`, exactly as it does the board bridge.
 */
export interface Config {
  /** Campaign runs/ directory holding `<session>/skill_index.json`. */
  readonly runsDir: string
  /** Chat-completions model id (e.g. `deepseek-v4-flash-vision-exp`). */
  readonly model: string
  /** Credential reference resolved per request; defaults to `DEEPSEEK_API_KEY`. */
  readonly apiKeyEnv: string
  /** Endpoint base; falls back to $DEEPSEEK_BASE_URL then the public API. */
  readonly baseURL: string
  /** Per-request timeout in ms. */
  readonly timeoutMs: number
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    brain: Brain
  }
}

/**
 * Remote planner over DeepSeek's chat-completions API. One method, `plan`; the
 * gateway auto-serves it at POST /api/brain/plan.
 */
export class Brain extends TypertRemoteService {
  /** Loader validation; `runsDir` and `model` are required, the rest default. */
  static Config: s<Config> = s.object({
    runsDir: s.string().required(),
    model: s.string().required(),
    apiKeyEnv: s.string().default(DEFAULT_API_KEY_ENV),
    baseURL: s.string().default(PUBLIC_BASE_URL),
    timeoutMs: s.number().min(1).default(DEFAULT_TIMEOUT_MS),
  })

  private readonly config: Config

  /**
   * @param ctx - owning Cordis Context.
   * @param config - box-specific config.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'brain')
    this.config = config
  }

  /**
   * Decompose a mission into a plan of harness skills, choosing each executor by
   * measured success. Reads `<runsDir>/<session>/skill_index.json` as context
   * and calls the model once; on a replan the caller passes the prior failures.
   * @param mission - the operator's mission text.
   * @param session - runtime session whose skill index to read (e.g. `session-main`).
   * @param priorFailuresJson - JSON array of prior failed attempts, or `''`/`'[]'`
   * on the first turn; forwarded to the model verbatim as failure evidence.
   * @returns a {@link BrainPlan} as JSON (`steps`/`flags`/`note`), or the same
   * shape with an `error` key when the index is missing, the credential is
   * unconfigured, or the model call fails.
   */
  @Remote('plan')
  async plan(mission: string, session: string, priorFailuresJson: string): Promise<JsonValue> {
    const index = await this.readSkillIndex(session)
    if (index === undefined) {
      return errorPlan('skill-index-missing',
        `no skill_index.json for session ${session}; boot the runtime for that session first`)
    }
    const key = await this.resolveKey()
    if (key === undefined) {
      return errorPlan('no-credential',
        `no API key: store ${this.config.apiKeyEnv} through the credentials store`)
    }
    let priorFailures: unknown[] = []
    try {
      const parsed: unknown = priorFailuresJson.trim().length === 0 ? [] : JSON.parse(priorFailuresJson)
      if (Array.isArray(parsed)) priorFailures = parsed
    } catch {
      // A malformed replan context is the caller's bug, not the operator's; plan
      // from scratch rather than fail the turn.
      priorFailures = []
    }
    const text = await this.complete(key, buildMessages(index, mission, priorFailures))
    if (text.error !== undefined) return errorPlan('llm-transport', text.error)
    return parsePlan(text.content) as unknown as JsonValue
  }

  /** Read and parse `<runsDir>/<session>/skill_index.json`, or undefined when
   * absent or unreadable (a session whose runtime has not booted). */
  private async readSkillIndex(session: string): Promise<SkillIndex | undefined> {
    // ponytail: session names the cockpit lists are trusted board children; a
    // traversal name would only read a file this process can already read.
    try {
      const raw = await readFile(join(this.config.runsDir, session, 'skill_index.json'), 'utf8')
      return JSON.parse(raw) as SkillIndex
    } catch {
      return undefined
    }
  }

  /** Resolve the API key through the credentials seam; undefined when unconfigured. */
  private async resolveKey(): Promise<string | undefined> {
    const credentials = this.ctx.get('credentials')
    if (credentials === undefined) return undefined
    const hit = await credentials.resolve(credentialRef(this.config.apiKeyEnv))
    return hit?.value
  }

  /** One chat-completions call. Returns the assistant text, or an `error`
   * string (never the key or headers) when the request or decode fails. */
  private async complete(key: string, messages: ReadonlyArray<{ role: string; content: string }>):
  Promise<{ content: string; error?: undefined } | { content: ''; error: string }> {
    const baseURL = (this.config.baseURL || process.env.DEEPSEEK_BASE_URL || PUBLIC_BASE_URL).replace(/\/+$/u, '')
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, this.config.timeoutMs)
    try {
      const res = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0,
        }),
        signal: controller.signal,
      })
      if (!res.ok) return { content: '', error: `deepseek ${res.status} ${res.statusText}` }
      const body = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      const content = body.choices?.[0]?.message?.content
      if (typeof content !== 'string') return { content: '', error: 'deepseek reply had no message content' }
      return { content }
    } catch (e) {
      return { content: '', error: e instanceof Error ? e.message : 'chat-completions request failed' }
    } finally {
      clearTimeout(timer)
    }
  }
}

/** An error plan the panel can render as-is (empty steps, the reason in `note`). */
function errorPlan(error: string, note: string): JsonValue {
  return { steps: [], flags: [note], note, error } satisfies BrainPlan as unknown as JsonValue
}

export default Brain
