/**
 * The planner's pure half: build the model request from the skill index and
 * mission, and parse the model's JSON reply into a {@link BrainPlan}. No
 * network, no filesystem, no credentials — the {@link Brain} Remote owns those
 * and calls these so the decomposition rule is unit-testable on fixtures.
 *
 * @module @deepseek-ai/dsh-ph-brain/planner
 */

import type { BrainPlan, BrainStep, SkillIndex } from './types.ts'

/** Scratch-seed window the planner draws from: seeds in `[42xxxx]` never burn
 * the irreversible seed ledger (physical-harness CLAUDE.md), so an exploratory
 * mission dispatch cannot poison a future gate or held-out block. */
const SCRATCH_SEED_LO = 420000
const SCRATCH_SEED_HI = 439999

/** One `{role, content}` message in the OpenAI-compatible chat request. */
export interface ChatMessage { readonly role: 'system' | 'user'; readonly content: string }

/**
 * The standing instructions to the planner. Written from the model's point of
 * view (packages/AGENTS: model-facing contracts carry only task concepts): it
 * selects skills FROM the index, picks the executor by measured success, honors
 * the null measurements instead of routing around them, and emits the one brief
 * grammar the harness accepts.
 */
export const SYSTEM_PROMPT = [
  'You are the planner for a physical robot. You are given a skill index — the',
  'complete, measured library of skills this robot can run right now — and a',
  'mission. Decompose the mission into an ordered sequence of skills DRAWN ONLY',
  'FROM THE INDEX. You may not invent a skill name that is not a key of',
  '`skills`. Prefer an ordering the index\'s `edges` support (an edge from A to',
  'B means B\'s preconditions are met by A\'s effects).',
  '',
  'For each skill, choose the executor by MEASURED SUCCESS: each record under a',
  'skill carries `measured.successes` of `measured.n` and a `binding`. Pick the',
  'record with the highest success rate and set `executor` to its `digest`.',
  'The measurements are honest and include nulls. If EVERY record for a needed',
  'skill has n=0 or a low success rate, DO NOT substitute another skill to',
  'route around it: set that step\'s `executor` to null, still include the step,',
  'and add a plain-language entry to `flags` telling the operator that skill is',
  'unreliable and needs their decision. Flagging an unreliable skill is correct',
  'behavior, not a failure.',
  '',
  'Each step becomes one work order (a "brief") the robot runtime claims:',
  '  {"kind":"task","task":<skill name>,"seed":<int>,"max_replans":<int>,"max_actuations":<int>}',
  `Use a seed in [${SCRATCH_SEED_LO}, ${SCRATCH_SEED_HI}] (these are scratch`,
  'seeds and safe to reuse). Set max_replans to at most 3 and max_actuations to',
  'a small budget appropriate to the skill (e.g. 40).',
  '',
  'If prior attempts are given, they FAILED — read their status and produce a',
  'revised plan for the remaining work (reorder, adjust budgets, or flag the',
  'skill if it keeps failing). Do not repeat a plan that just failed unchanged.',
  '',
  'Refuse rather than improvise. If the mission is empty or has no actionable',
  'content, or if accomplishing it needs an action no skill in the index provides',
  '(e.g. washing, folding, cutting), return empty steps, name the gap in `flags`,',
  'and say why in `note`. Never repurpose the pick-and-place skills to "cover" a',
  'mission they cannot accomplish, and never emit a default plan when the mission',
  'does not call for one.',
  '',
  'Reply with ONE JSON object and nothing else:',
  '  {"steps":[{"task":str,"executor":str|null,"seed":int,"max_replans":int,',
  '            "max_actuations":int,"rationale":str}],',
  '   "flags":[str], "note":str}',
  'If the index cannot cover the mission at all, return empty steps, say why in',
  '`note`, and put the gap in `flags`.',
].join('\n')

/**
 * Assemble the chat request for one planning turn.
 * @param index - the parsed skill index the runtime wrote for this session.
 * @param mission - the operator's mission text.
 * @param priorFailures - JSON array of prior failed attempts (task + status),
 * or an empty array on the first turn; forwarded verbatim so the model sees the
 * same failure evidence the operator does.
 * @returns the system + user messages for the completion request.
 */
export function buildMessages(index: SkillIndex, mission: string, priorFailures: unknown[]): ChatMessage[] {
  const parts = [
    `SKILL INDEX:\n${JSON.stringify(index)}`,
    `MISSION:\n${mission}`,
  ]
  if (priorFailures.length > 0) parts.push(`PRIOR FAILED ATTEMPTS:\n${JSON.stringify(priorFailures)}`)
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: parts.join('\n\n') },
  ]
}

/** Coerce one model-emitted step to the wire shape, clamping the replan budget
 * to the harness ceiling of 3 and dropping anything without a task name. */
function coerceStep(raw: unknown): BrainStep | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  if (typeof r.task !== 'string' || r.task.length === 0) return undefined
  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback
  return {
    task: r.task,
    executor: typeof r.executor === 'string' && r.executor.length > 0 ? r.executor : null,
    seed: num(r.seed, SCRATCH_SEED_LO),
    max_replans: Math.min(3, Math.max(0, num(r.max_replans, 3))),
    max_actuations: Math.max(1, num(r.max_actuations, 40)),
    rationale: typeof r.rationale === 'string' ? r.rationale : '',
  }
}

/**
 * Parse the model's reply text into a {@link BrainPlan}. Tolerant of a fenced
 * code block around the JSON; anything the model returns that is not a JSON
 * object with a `steps` array is reported as an error plan rather than thrown,
 * so the caller always has a renderable result (never the model's raw key-free
 * text on the wire beyond `error`).
 * @param text - the assistant message content.
 * @returns the parsed plan, or an error plan naming why it could not be read.
 */
export function parsePlan(text: string): BrainPlan {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { steps: [], flags: [], note: 'planner returned unparseable output', error: 'unparseable-plan' }
  }
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as Record<string, unknown>).steps)) {
    return { steps: [], flags: [], note: 'planner reply had no steps array', error: 'malformed-plan' }
  }
  const obj = parsed as Record<string, unknown>
  const steps = (obj.steps as unknown[]).map(coerceStep).filter((s): s is BrainStep => s !== undefined)
  const flags = Array.isArray(obj.flags) ? obj.flags.filter((f): f is string => typeof f === 'string') : []
  const note = typeof obj.note === 'string' ? obj.note : ''
  return { steps, flags, note }
}
