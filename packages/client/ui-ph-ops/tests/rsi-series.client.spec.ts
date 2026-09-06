import { describe, expect, it } from 'vitest'
import { buildLearningSeries } from '../src/client/rsi-series.ts'
import type { SeriesPoint } from '../src/client/types.ts'

function row(round: number, objective = 'a', values: Partial<SeriesPoint> = {}): SeriesPoint {
  return { round, evaluation: { protocol_id: 'fixed', objective_id: objective,
    before: { progress: 0.1, successes: 0, episodes: 2 }, after: null }, ...values }
}

describe('learning curve measurements', () => {
  it('uses actual rounds of the newest contiguous evaluator, not the entire campaign axis', () => {
    const series = [row(1), row(2), row(73, 'b'), row(74, 'b'), row(75, 'b')]
    const view = buildLearningSeries(series, 'progress')
    expect(view.epochs.map(e => [e.firstRound, e.lastRound])).toEqual([[1, 2], [73, 75]])
    expect(view.domain).toEqual([73, 75])
    expect(view.points.map(p => [p.round, p.policy, p.candidate])).toEqual([
      [73, 0.1, null], [74, 0.1, null], [75, 0.1, null],
    ])
    expect(buildLearningSeries(series, 'progress', view.epochs[0]!.id).domain).toEqual([1, 2])
    expect(buildLearningSeries(series, 'progress', 'deleted-epoch').epoch).toEqual(view.epoch)
  })

  it('shows accepted policy updates and rejected candidate measurements separately', () => {
    const series = [row(1), row(2, 'a', { accepted: true, evaluation: {
      protocol_id: 'fixed', objective_id: 'a', before: { progress: 0.1 }, after: { progress: 0.6 },
      acceptance: { accepted: false },
    } }), row(3, 'a', { accepted: false, evaluation: {
      protocol_id: 'fixed', objective_id: 'a', before: { progress: 0.1 }, after: { progress: 0.4 },
      acceptance: { accepted: true },
    } }), row(4, 'a', { accepted: true, evaluation: {
      protocol_id: 'fixed', objective_id: 'a', before: { progress: 0.4 }, after: { progress: 0.9 },
      acceptance: { accepted: null },
    } })]
    expect(buildLearningSeries(series, 'progress').points.map(p => [p.policy, p.candidate, p.accepted]))
      .toEqual([[0.1, null, false], [0.1, 0.6, false], [0.4, 0.4, true], [0.4, 0.9, false]])
  })

  it('preserves true zeros and leaves missing rounds or unmeasured values disconnected', () => {
    const series = [row(1, 'a', { evaluation: { protocol_id: 'fixed', objective_id: 'a', before: { progress: 0 } } }),
      row(2, 'a', { evaluation: null }), row(3), row(5)]
    const view = buildLearningSeries(series, 'progress')
    expect(view.points.map(p => p.policy)).toEqual([0, null, 0.1, 0.1])
    expect(view.policySegments).toEqual([[{ round: 1, value: 0 }], [{ round: 3, value: 0.1 }], [{ round: 5, value: 0.1 }]])
  })

  it('never pools a reappearing contract or different protocol into an older curve', () => {
    const series = [row(1), row(2, 'b'), row(3), row(4, 'a', { evaluation: {
      protocol_id: 'another-verifier', objective_id: 'a', before: { progress: 0.2 },
    } })]
    expect(buildLearningSeries(series, 'progress').epochs).toHaveLength(4)
  })

  it('isolates unidentified evaluations and does not relabel legacy node diagnostics as reward', () => {
    const legacy: SeriesPoint = { round: 1, before: 1, after: 2, node_rate: { before: 0.5, after: 1 } }
    expect(buildLearningSeries([legacy], 'progress').points[0]!.policy).toBeNull()
    const view = buildLearningSeries([{ round: 2, evaluation: { before: { progress: 0.2 } } },
      { round: 3, evaluation: { before: { progress: 0.3 } } }], 'progress')
    expect(view.epochs).toHaveLength(2)
    expect(view.epoch!.comparable).toBe(false)
    expect(view.domain).toEqual([2.5, 3.5])
    expect(view.points).toHaveLength(1)
  })

  it('uses each evaluation denominator for task success, including measured failures', () => {
    const make = (round: number, successes: number | null, episodes: number | null) => row(round, 'a', {
      evaluation: { protocol_id: 'fixed', objective_id: 'a', before: { successes, episodes } },
    })
    expect(buildLearningSeries([make(1, 0, 2), make(2, 1, 4), make(3, null, 2),
      make(4, 0, 0), make(5, 3, 2), make(6, 1.5, 2)], 'success').points.map(p => p.policy))
      .toEqual([0, 0.25, null, null, null, null])
  })

  it('does not clamp invalid wire readings into apparent improvements', () => {
    const rows = [NaN, Infinity, -0.1, 1.1, null].map((progress, i) => row(i + 1, 'a', {
      evaluation: { protocol_id: 'fixed', objective_id: 'a', before: { progress } },
    }))
    expect(buildLearningSeries(rows, 'progress').points.every(p => p.policy === null)).toBe(true)
  })

  it('sorts snapshots and replaces duplicates without mutating the polling response', () => {
    const rows = [row(74, 'b'), row(73, 'b'), row(74, 'b', { accepted: true })]
    const copy = structuredClone(rows)
    const view = buildLearningSeries(rows, 'progress')
    expect(view.points.map(p => p.round)).toEqual([73, 74])
    expect(view.points[1]!.accepted).toBe(true)
    expect(rows).toEqual(copy)
    expect(buildLearningSeries([], 'progress')).toMatchObject({ epoch: null, epochs: [], points: [], policySegments: [] })
  })
})


it('retains the full round range with separate segments at every version boundary', () => {
  const series = [row(1), row(2), row(3, 'b'), row(4, 'b'), row(5)]
  const result = buildLearningSeries(series, 'progress', 'all')
  expect(result.domain).toEqual([1, 5])
  expect(result.epoch).toBeNull()
  expect(result.points.map(point => point.round)).toEqual([1, 2, 3, 4, 5])
  expect(result.policySegments.map(segment => segment.map(point => point.round))).toEqual([[1, 2], [3, 4], [5]])
  const next = buildLearningSeries([...series, row(6, 'new')], 'progress', 'all')
  expect(next.points).toHaveLength(6)
  expect(next.policySegments.at(-1)?.map(point => point.round)).toEqual([6])
})
