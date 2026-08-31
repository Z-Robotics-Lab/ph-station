/** The brain's dispatch loop, framework-free so it is testable without React or
 * the network: decompose (given) → dispatch → watch → replan-on-failure,
 * bounded. Every side effect is an injected async function; the React panel
 * wires the board and brain Remotes into them and renders the `onStep`
 * progression. The one execution door is `submit` (board.submitBrief) followed
 * by `poll` (board.briefStatus); the brain never bypasses the board.
 *
 * @module @deepseek-ai/dsh-client-ui-ph-ops/planner-loop
 */

/** Hard ceiling on replans, matching physical-harness discipline: after this
 * many failed rounds the loop stops and flags the operator rather than looping
 * forever. */
export const MAX_REPLANS = 3

/** One planned step (the subset the loop dispatches; the brain returns more). */
export interface LoopStep {
  readonly task: string
  readonly executor: string | null
  readonly seed: number
  readonly max_replans: number
  readonly max_actuations: number
}

/** A terminal or in-flight brief state read from board.briefStatus. */
export interface BriefStatus {
  readonly state: string
  readonly brief_id?: string
  readonly task?: string
  readonly outcome?: unknown
  readonly error?: string
}

/** One step's progression through the loop, reported to the UI as it happens. */
export interface StepReport {
  readonly index: number
  readonly task: string
  readonly phase: 'dispatching' | 'watching' | 'done' | 'failed' | 'flagged'
  readonly briefId?: string
  readonly status?: BriefStatus
  readonly detail?: string
}

/** Injected effects. Each returns a discriminated result so the loop never
 * throws on an expected board/brain error. */
export interface LoopDeps {
  /** Drop one task brief; returns its brief id or an error. */
  submit: (step: LoopStep) => Promise<{ briefId: string } | { error: string }>
  /** Poll one brief to a terminal state (the impl long-polls and loops). */
  poll: (briefId: string) => Promise<BriefStatus>
  /** Ask the brain for a revised plan given the failures so far; empty steps
   * means "nothing left to try". */
  replan: (failures: ReadonlyArray<{ task: string; status: BriefStatus }>) => Promise<LoopStep[]>
  /** Report progress to the UI. */
  onStep: (report: StepReport) => void
}

/** States that mean the brief will never progress further. */
const TERMINAL = new Set(['done', 'failed', 'cancelled', 'stalled'])

/** Whether a brief-status state counts as success. */
function isDone(status: BriefStatus): boolean {
  return status.state === 'done'
}

/** Whether a state is terminal (loop stops polling this brief). */
export function isTerminal(state: string): boolean {
  return TERMINAL.has(state)
}

/** The loop's outcome. */
export interface LoopResult {
  readonly completed: boolean
  readonly replans: number
  /** Operator-facing reason the loop stopped short, when it did. */
  readonly flag?: string
}

/**
 * Run the bounded dispatch loop over an initial plan.
 * @param initial - the brain's first decomposition.
 * @param deps - injected board/brain effects and the progress callback.
 * @returns whether the whole plan completed, how many replans it used, and a
 * flag when it stopped short (a step failed with no executor, replans
 * exhausted, or the brain returned no recovery).
 */
export async function runPlan(initial: LoopStep[], deps: LoopDeps): Promise<LoopResult> {
  let plan = initial
  let replans = 0
  const failures: Array<{ task: string; status: BriefStatus }> = []

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i]
    if (step === undefined) break
    if (step.executor === null) {
      deps.onStep({ index: i, task: step.task, phase: 'flagged', detail: 'no reliable executor for this skill' })
      return { completed: false, replans, flag: `${step.task}: no reliable executor — operator decision needed` }
    }

    deps.onStep({ index: i, task: step.task, phase: 'dispatching' })
    const submitted = await deps.submit(step)
    if ('error' in submitted) {
      deps.onStep({ index: i, task: step.task, phase: 'failed', detail: submitted.error })
      return { completed: false, replans, flag: `${step.task}: dispatch failed (${submitted.error})` }
    }

    deps.onStep({ index: i, task: step.task, phase: 'watching', briefId: submitted.briefId })
    const status = await deps.poll(submitted.briefId)

    if (isDone(status)) {
      deps.onStep({ index: i, task: step.task, phase: 'done', briefId: submitted.briefId, status })
      continue
    }

    deps.onStep({ index: i, task: step.task, phase: 'failed', briefId: submitted.briefId, status })
    failures.push({ task: step.task, status })

    if (replans >= MAX_REPLANS) {
      return { completed: false, replans, flag: `stopped after ${MAX_REPLANS} replans; ${step.task} still failing` }
    }
    replans++
    const revised = await deps.replan(failures)
    if (revised.length === 0) {
      return { completed: false, replans, flag: 'brain returned no recovery plan — operator decision needed' }
    }
    // Restart iteration over the revised plan for the remaining work.
    plan = revised
    i = -1
  }

  return { completed: true, replans }
}
