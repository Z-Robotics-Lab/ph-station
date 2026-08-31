/** Unit coverage for the bounded dispatch loop: it advances on `done`, flags a
 * null executor without dispatching, and stops after MAX_REPLANS. */

import { describe, expect, it, vi } from 'vitest'
import {
  isTerminal, MAX_REPLANS, runPlan, type BriefStatus, type LoopDeps, type LoopStep,
} from '../src/client/planner-loop.ts'

const step = (task: string, executor: string | null = 'exec'): LoopStep =>
  ({ task, executor, seed: 420000, max_replans: 3, max_actuations: 40 })

function deps(over: Partial<LoopDeps> = {}): LoopDeps {
  return {
    submit: vi.fn(async () => ({ briefId: 'b1' })),
    poll: vi.fn(async (): Promise<BriefStatus> => ({ state: 'done' })),
    replan: vi.fn(async () => []),
    onStep: vi.fn(),
    ...over,
  }
}

describe('isTerminal', () => {
  it('treats done/failed/cancelled/stalled as terminal, running/queued as not', () => {
    expect(['done', 'failed', 'cancelled', 'stalled'].every(isTerminal)).toBe(true)
    expect(['running', 'queued'].some(isTerminal)).toBe(false)
  })
})

describe('runPlan', () => {
  it('dispatches every step and completes when all briefs finish done', async () => {
    const d = deps()
    const res = await runPlan([step('navigate'), step('grasp')], d)
    expect(res.completed).toBe(true)
    expect(res.replans).toBe(0)
    expect(d.submit).toHaveBeenCalledTimes(2)
  })

  it('flags a null-executor step and never dispatches it', async () => {
    const d = deps()
    const res = await runPlan([step('place', null)], d)
    expect(res.completed).toBe(false)
    expect(res.flag).toContain('no reliable executor')
    expect(d.submit).not.toHaveBeenCalled()
  })

  it('replans on failure and stops after MAX_REPLANS when it keeps failing', async () => {
    const d = deps({
      poll: vi.fn(async (): Promise<BriefStatus> => ({ state: 'failed' })),
      // Each replan hands back another single failing step, so the loop exhausts
      // its replan budget rather than looping forever.
      replan: vi.fn(async () => [step('carry')]),
    })
    const res = await runPlan([step('carry')], d)
    expect(res.completed).toBe(false)
    expect(res.replans).toBe(MAX_REPLANS)
    expect(res.flag).toContain(`${MAX_REPLANS} replans`)
  })

  it('stops when the brain returns no recovery plan', async () => {
    const d = deps({ poll: vi.fn(async (): Promise<BriefStatus> => ({ state: 'failed' })), replan: vi.fn(async () => []) })
    const res = await runPlan([step('carry')], d)
    expect(res.completed).toBe(false)
    expect(res.flag).toContain('no recovery plan')
  })

  it('surfaces a submit error as a flag', async () => {
    const d = deps({ submit: vi.fn(async () => ({ error: 'board down' })) })
    const res = await runPlan([step('navigate')], d)
    expect(res.completed).toBe(false)
    expect(res.flag).toContain('board down')
  })
})
