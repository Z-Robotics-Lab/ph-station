// @vitest-environment jsdom
/**
 * RSI page: it lists campaigns found through rsiRun,
 * draws the rsiSeries chart as inline SVG, tells one round in its four beats
 * (看到了什么 / 试了什么 / 结果 / 发布), filters the runtime feed to this brief's
 * lines, starts a campaign with a task-only brief, stops the open brief through
 * cancelBrief, and keeps the strict-evaluation block collapsed until asked.
 * Board faces are mocked at the injected face.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { RsiView, describeTried } from '../src/client/RsiView.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const ok = (value: unknown): RemoteResult<unknown> => ({ ok: true, value })
const t = (key: keyof typeof en, params?: Record<string, unknown>) =>
  en[key].replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k]))
const sessions = ok([{ name: 'session-main', kinds: { 'runtime.boot': 1 } }])

describe('RsiView', () => {
  const campaign = {
    task: 'kitchen_thaw', session: 'session-main', seeds: [1, 3], arm: 'auto', status: 'running',
    best: 2, cursor: 2,
    rounds: [
      { round: 1, tried: { kind: 'executor', node: 'grasp-0', detail: { skill: 'grasp', from: 'scripted', to: 'pi05' } },
        before: 1, after: 2, best: 2, published: true, media: ['media/kitchen_thaw/1/grasp-0.mp4'],
        per_seed: [{ seed: 1, success: true, first_death: null, failure_mode: null }, { seed: 2, success: false, first_death: 'grasp-0', failure_mode: 'reach_stall' }, { seed: 3, success: true, first_death: null, failure_mode: null }],
        needs: [], media_dropped: { '2/grasp-0': 'verify_failed' } },
      { round: 2, tried: { kind: 'none', node: 'grasp-0', detail: { reason: 'no untried executor', needs: ['tunables on grasp', 'proposal'] } },
        before: 2, after: 2, best: 2, published: false, media: [], per_seed: [], needs: ['tunables on grasp', 'proposal'], media_dropped: {} },
    ],
    latest: { round: 2, tried: { kind: 'none', node: 'grasp-0', detail: { reason: 'no untried executor' } }, before: 2, after: 2, best: 2, media: [] },
  }
  const events = [
    { seq: 1, kind: 'boot' },
    { seq: 2, kind: 'task_claimed', brief: 'b-evolve', task: 'kitchen_thaw' },
    { seq: 3, kind: 'task_claimed', brief: 'b-other', task: 'pack_lunch' },
    { seq: 4, kind: 'task_done', brief: 'b-other', task: 'pack_lunch' },
    { seq: 5, kind: 'rsi_round', brief: 'b-evolve', round: 1 },
  ]
  function props(over: object = {}) {
    return {
      fetchCards: vi.fn(() => Promise.resolve(ok([{ contributes: { task_bindings: ['kitchen_thaw', 'pack_lunch'] } }]))),
      fetchSessions: vi.fn(() => Promise.resolve(sessions)),
      fetchRuntimeEvents: vi.fn(() => Promise.resolve(ok({ events, last_seq: 5 }))),
      fetchRsiRun: vi.fn((_s: string, task: string) => Promise.resolve(ok(task === 'kitchen_thaw' ? campaign : null))),
      fetchRsiSeries: vi.fn(() => Promise.resolve(ok(
        campaign.rounds.map(({ round, before, after, best }) => ({ round, before, after, best })),
      ))),
      fetchRsiFrames: vi.fn((_s: string, _t: string, round: number) => Promise.resolve(ok(round === 1 ? ['media/kitchen_thaw/1/grasp-0.mp4'] : []))),
      submitBrief: vi.fn(() => Promise.resolve(ok({ submitted: 'b-new', inbox: 'x' }))),
      cancelBrief: vi.fn(() => Promise.resolve(ok({ brief_id: 'b-evolve', requested: true }))),
      renderView: vi.fn((id: string) => <div>view:{id}</div>),
      t,
      ...over,
    }
  }
  const mount = (p: ReturnType<typeof props>) =>
    render(<RsiView {...(p as unknown as Parameters<typeof RsiView>[0])} />)

  it('lists campaigns, then tells the picked one in loop order: chart, round beats, clips, log', async () => {
    const p = props()
    const { container } = mount(p)
    await waitFor(() => { expect(screen.getByText('kitchen_thaw')).toBeTruthy() })
    expect(p.fetchRsiRun).toHaveBeenCalledWith('session-main', 'pack_lunch')
    expect(screen.queryByText('pack_lunch')).toBeNull()
    // The task picker offers the cards' task_bindings as a native datalist.
    expect(container.querySelectorAll('datalist option')).toHaveLength(2)
    fireEvent.click(screen.getByText('kitchen_thaw'))
    await waitFor(() => { expect(container.querySelectorAll('polyline')).toHaveLength(3) })
    expect(p.fetchRsiSeries).toHaveBeenCalledWith('session-main', 'kitchen_thaw')
    expect(container.querySelector('polyline[data-series="best"]')?.getAttribute('points')).toMatch(/^10,10 310,10$/)
    // Head status line + the selected campaign's task prefilled for 继续.
    expect(screen.getByText('Round 2 · best 2/3 · running')).toBeTruthy()
    expect((screen.getByPlaceholderText(en['evolve.taskHint']) as HTMLInputElement).value).toBe('kitchen_thaw')
    // Round 1 card: the four beats.
    expect(screen.getByText('Round 1')).toBeTruthy()
    expect(screen.getAllByText(en['rsi.saw'])).toHaveLength(2)
    expect(screen.getByText('reach_stall')).toBeTruthy()
    expect(screen.getByText('grasp-0: switch executor to pi05')).toBeTruthy()
    expect(screen.getByText('1 → 2 (best 2)')).toBeTruthy()
    expect(screen.getByText(en.yes)).toBeTruthy()
    // Round 2 tried nothing: its needs list shows; round 1 has no needs row.
    expect(screen.getByText('tunables on grasp · proposal')).toBeTruthy()
    expect(screen.getAllByText(en['rsi.needs'])).toHaveLength(1)
    // Log filtered to the evolve brief: the other brief's lines are gone.
    const log = container.querySelector('pre')?.textContent ?? ''
    expect(log).toContain('"brief":"b-evolve"')
    expect(log).not.toContain('b-other')
    // Round 2 (latest) has no media; picking round 1 fetches its frames and shows its dropped reasons.
    expect(screen.getByText(en['evolve.noMedia'])).toBeTruthy()
    fireEvent.click(screen.getByText('Round 1'))
    await waitFor(() => { expect(screen.getByText(/media\/kitchen_thaw\/1\/grasp-0\.mp4/)).toBeTruthy() })
    expect(p.fetchRsiFrames).toHaveBeenCalledWith('session-main', 'kitchen_thaw', 1)
    expect(screen.getByText(/verify_failed/)).toBeTruthy()
    // The brief is open (claimed, no terminal marker): Stop cancels it.
    fireEvent.click(screen.getByRole('button', { name: en['evolve.stop'] }))
    await waitFor(() => { expect(p.cancelBrief).toHaveBeenCalledWith('b-evolve', 'session-main') })
  })

  it('keeps the strict-evaluation block collapsed, then renders the legacy views by id', async () => {
    const p = props()
    const { container } = mount(p)
    await waitFor(() => { expect(screen.getByText('kitchen_thaw')).toBeTruthy() })
    const details = container.querySelector('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(screen.getByText(en['rsi.strictNote'])).toBeTruthy()
    fireEvent.click(container.querySelector('summary') as HTMLElement)
    expect(details.open).toBe(true)
    expect(screen.getByText('view:rsi-strict')).toBeTruthy()
    expect(screen.getByText('view:evolution')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: en['rsi.tab.battle'] }))
    expect(screen.getByText('view:battle')).toBeTruthy()
  })

  it('needs a task to start, then submits the task-only evolve brief; stop is disabled with no open brief', async () => {
    const p = props({
      fetchRuntimeEvents: vi.fn(() => Promise.resolve(ok({
        events: [...events, { seq: 6, kind: 'task_cancelled', brief: 'b-evolve', task: 'kitchen_thaw' }], last_seq: 6,
      }))),
    })
    mount(p)
    await waitFor(() => { expect(screen.getByText('kitchen_thaw')).toBeTruthy() })
    const start = screen.getByRole('button', { name: en['evolve.start'] }) as HTMLButtonElement
    expect(start.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText(en['evolve.taskHint']), { target: { value: 'pack_lunch' } })
    expect(start.disabled).toBe(false)
    fireEvent.click(start)
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledWith('{"kind":"evolve","task":"pack_lunch"}', 'session-main') })
    // Resume = pick the campaign (prefills its task) and press the same button.
    fireEvent.click(screen.getByText('kitchen_thaw'))
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: en['evolve.start'] }))
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledWith('{"kind":"evolve","task":"kitchen_thaw"}', 'session-main') })
    expect(p.cancelBrief).not.toHaveBeenCalled()
  })
})

describe('describeTried', () => {
  it('humanizes every kind scripts/evolve.py writes', () => {
    const tt = t as unknown as Parameters<typeof describeTried>[1]
    expect(describeTried({ kind: 'tunables', node: 'drop-can1', detail: { path: ['reach_tol'], from: 0.03, to: 0.036 } }, tt)).toBe('drop-can1: reach_tol 0.03 → 0.036')
    expect(describeTried({ kind: 'card', node: 'grasp-0', detail: { to: 'geometric', error: 'boom' } }, tt)).toBe('grasp-0: mount candidate card geometric · boom')
    expect(describeTried({ kind: 'none', node: null as never, detail: { reason: 'every seed succeeded' } }, tt)).toBe('Nothing to try: every seed succeeded')
    expect(describeTried({ kind: 'mystery', node: 'n' }, tt)).toBe('mystery @ n')
  })
})

describe('evolveSessions', () => {
  it('offers only evolution-mode runtimes, a live one first, when modes are known', async () => {
    const { evolveSessions, pickEvolveDefault } = await import('../src/client/OperatorRail.tsx')
    const list = [
      { name: 'session-robocasa', mode: 'execution', runtime_alive: true },
      { name: 'session-robocasa-evolution', mode: 'evolution', runtime_alive: false },
      { name: 'session-robocasa-rsi', mode: 'evolution', runtime_alive: true },
    ]
    expect(evolveSessions(list).map(s => s.name)).toEqual(['session-robocasa-evolution', 'session-robocasa-rsi'])
    expect(pickEvolveDefault(list)).toBe('session-robocasa-rsi')
    expect(pickEvolveDefault([{ name: 'session-main', kinds: { 'runtime.boot': 1 } }])).toBe('session-main')
  })
})
