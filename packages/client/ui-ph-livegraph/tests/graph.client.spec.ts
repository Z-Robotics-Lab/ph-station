/** Fold checks: replay-by-truncation, run splitting, and replan lineage — the
 * three non-trivial behaviors the merged graph relies on. */

import { describe, expect, it } from 'vitest'
import { foldEvents, foldRuns, layout, type OpEvent } from '../src/client/graph.ts'
import { runWindow } from '../src/client/RunFeed.tsx'
import { pickRuntimeSession } from '../src/client/useLiveFeed.ts'

describe('pickRuntimeSession', () => {
  it('skips a newer non-runtime session for the newest runtime one', () => {
    // Board sorts mtime-desc: a completed campaign (no runtime.boot) sits at [0]
    // ahead of the live session — the live surfaces must still follow the latter.
    const list = [
      { name: 'grasp-cube-g1', kinds: { 'rsi.campaign_complete': 1 } },
      { name: 'session-main', kinds: { 'runtime.boot': 1, 'task.plan_complete': 6 } },
    ]
    expect(pickRuntimeSession(list)).toBe('session-main')
  })
  it('falls back to the newest session when none carries a runtime marker', () => {
    expect(pickRuntimeSession([{ name: 'cal-a', kinds: {} }, { name: 'cal-b' }])).toBe('cal-a')
  })
  it('is null on an empty list', () => {
    expect(pickRuntimeSession([])).toBeNull()
  })
})

/** A two-run feed: run A (seed 0) fails once then retries and fails; run B
 * (seed 1) succeeds first try. Mirrors the real runtime_events shape. */
const FEED: OpEvent[] = [
  { seq: 1, kind: 'boot', mode: 'execution', ts: 0 },
  { seq: 2, kind: 'task_claimed', task: 'stack', seed: 0, ts: 1 },
  { seq: 3, kind: 'plan_built', replan: 0, goal: 'stack A on B', nodes: [{ id: 'stack-0', skill: 'stack', args: { object: 'cubeA' } }], verify: [{ after: 'stack-0', predicate: 'stack_success' }], ts: 1 },
  { seq: 4, kind: 'node_start', node: 'stack-0', skill: 'stack', ts: 1 },
  { seq: 5, kind: 'stage_transition', stage: 'grasp', success: true, ts: 2 },
  { seq: 6, kind: 'stage_transition', stage: 'place', success: false, ts: 3 },
  { seq: 7, kind: 'actuation_end', steps: 258, success: false, ts: 4 },
  { seq: 8, kind: 'node_failed', node: 'stack-0', failed: ['place', 'stack_success'], ts: 4 },
  { seq: 9, kind: 'replan', replan: 1, node: 'stack-0', ts: 4 },
  { seq: 10, kind: 'plan_built', replan: 1, nodes: [{ id: 'stack-0', skill: 'stack' }], ts: 4 },
  { seq: 11, kind: 'node_start', node: 'stack-0', skill: 'stack', ts: 5 },
  { seq: 12, kind: 'stage_transition', stage: 'grasp', success: false, ts: 6 },
  { seq: 13, kind: 'node_failed', node: 'stack-0', failed: ['grasp'], ts: 7 },
  { seq: 14, kind: 'plan_complete', success: false, replans: 1, ts: 7 },
  { seq: 15, kind: 'task_done', ts: 7 },
  { seq: 16, kind: 'task_claimed', task: 'stack', seed: 1, ts: 8 },
  { seq: 17, kind: 'plan_built', replan: 0, goal: 'stack A on B', nodes: [{ id: 'stack-0', skill: 'stack' }], ts: 8 },
  { seq: 18, kind: 'node_start', node: 'stack-0', ts: 9 },
  { seq: 19, kind: 'stage_transition', stage: 'grasp', success: true, ts: 10 },
  { seq: 20, kind: 'node_verified', node: 'stack-0', ts: 11 },
  { seq: 21, kind: 'plan_complete', success: true, replans: 0, ts: 11 },
  { seq: 22, kind: 'task_done', ts: 11 },
]

const prefix = (k: number) => FEED.filter(e => e.seq <= k)

describe('foldRuns', () => {
  it('splits the feed into task_claimed→task_done runs with verdicts', () => {
    const runs = foldRuns(FEED)
    expect(runs.map(r => [r.seed, r.status, r.success])).toEqual([
      [0, 'failed', false],
      [1, 'done', true],
    ])
    const a = runs[0]!
    expect(a.firstSeq).toBe(2)
    expect(a.lastSeq).toBe(15)
    // markers carry the scrubber ticks (plan_built/node_*/replan/plan_complete).
    expect(a.markers.some(m => m.kind === 'node_failed')).toBe(true)
  })
})

describe('foldEvents replay', () => {
  it('folds any seq-prefix to that mid-run state', () => {
    // Mid first attempt, after grasp passed but before place: node running.
    const mid = foldEvents(null, prefix(5))
    const running = mid.planNodes.find(n => n.status === 'running')
    expect(running?.stages.map(s => s.name)).toEqual(['grasp'])
    expect(mid.task?.status).toBe('running')
  })

  it('keeps failed attempts as replan lineage, final attempt keeps its verdict', () => {
    // End of run A: two attempts of stack-0; the first (superseded) reads
    // replanned, the last stays failed.
    const runA = foldEvents(null, prefix(15))
    const attempts = runA.planNodes.filter(n => n.id === 'stack-0')
    expect(attempts.map(n => n.attempt)).toEqual([0, 1])
    expect(attempts[0]!.status).toBe('replanned')
    expect(attempts[1]!.status).toBe('failed')
    expect(attempts[0]!.faults).toEqual(['place', 'stack_success'])
    // A branch edge links the two attempts; the plan edge comes off mission.
    const l = layout(runA, false)
    expect(l.edges.some(e => e.kind === 'branch' && e.target === 'plan:stack-0#1')).toBe(true)
    expect(l.edges.some(e => e.kind === 'plan' && e.source === 'mission')).toBe(true)
  })

  it('folding the whole feed lands in the last run (success)', () => {
    const all = foldEvents(null, FEED)
    expect(all.task?.seed).toBe(1)
    expect(all.planNodes).toHaveLength(1)
    expect(all.planNodes[0]!.status).toBe('verified')
  })

  it('marks the executing edge active in a live prefix', () => {
    const mid = foldEvents(null, prefix(5))
    const l = layout(mid, false)
    expect(l.edges.some(e => e.active === true)).toBe(true)
  })
})

describe('serpentine edge handles', () => {
  // Six sequential nodes wrapped at ~2 cards per row: rows alternate direction,
  // so edges must flip sides on reversed rows and drop through the gutter on wraps.
  const model = foldEvents(null, [
    { seq: 1, kind: 'task_claimed', task: 't', seed: 0, ts: 0 },
    {
      seq: 2, kind: 'plan_built', replan: 0, ts: 0,
      nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id, skill: id })),
    },
  ] as unknown as OpEvent[])

  it('anchors every chain edge on facing sides (no cross-card anchors)', () => {
    const { nodes, edges } = layout(model, false, 500)
    const byId = new Map(nodes.map(n => [n.id, n]))
    for (const e of edges) {
      const s = byId.get(e.source)!
      const t = byId.get(e.target)!
      if (t.position.y - s.position.y > 60) {
        // wrap (or mission→row) edge: leaves the bottom, enters the top.
        expect([e.sourceHandle, e.targetHandle]).toEqual(['b', 't'])
      } else if (t.position.x >= s.position.x) {
        expect([e.sourceHandle, e.targetHandle]).toEqual(['rs', 'lt'])
      } else {
        // reversed (right-to-left) row: sides flip.
        expect([e.sourceHandle, e.targetHandle]).toEqual(['ls', 'rt'])
      }
    }
    // The reflow actually produced both directions (guards the fixture).
    expect(edges.some(e => e.sourceHandle === 'ls')).toBe(true)
    expect(edges.some(e => e.sourceHandle === 'b')).toBe(true)
  })
})

describe('runWindow — the per-experiment ticker slice', () => {
  const runs = foldRuns(FEED)

  it('confines the ticker to the selected run, live (headSeq = run.lastSeq)', () => {
    const runA = runs[0]!
    const win = runWindow(FEED, runA, runA.lastSeq)
    // Every event lands inside run A's span, and none of run B's leaks in.
    expect(win.every(e => e.seq >= runA.firstSeq && e.seq <= runA.lastSeq)).toBe(true)
    expect(win.some(e => e.seq === 16)).toBe(false) // run B's task_claimed
    expect(win[0]!.seq).toBe(runA.firstSeq)
    expect(win.at(-1)!.seq).toBe(runA.lastSeq)
  })

  it('selecting a later run shows only that run', () => {
    const runB = runs[1]!
    const win = runWindow(FEED, runB, runB.lastSeq)
    expect(win.every(e => e.seq >= runB.firstSeq && e.seq <= runB.lastSeq)).toBe(true)
    expect(win.map(e => e.kind)).toContain('node_verified')
  })

  it('truncates to the scrubber playhead in replay', () => {
    const runA = runs[0]!
    const win = runWindow(FEED, runA, 6) // paused mid-first-attempt
    expect(win.every(e => e.seq <= 6)).toBe(true)
    expect(win.some(e => e.kind === 'node_failed')).toBe(false)
  })

  it('yields nothing when no run is selected', () => {
    expect(runWindow(FEED, undefined, Infinity)).toEqual([])
  })
})
