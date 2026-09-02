// @vitest-environment jsdom
/**
 * RSI page: it lists campaigns found through rsiRun,
 * draws the rsiSeries chart as inline SVG, tells one round in its four beats
 * (看到了什么 / 试了什么 / 结果 / 发布), filters the runtime feed to this brief's
 * lines, starts a campaign with a task-only brief, stops the open brief through
 * cancelBrief, and keeps the strict-evaluation block collapsed until asked.
 * Board faces are mocked at the injected face.
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { RsiView, describeEvent, describeTried } from '../src/client/RsiView.tsx'
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
      fetchRuntimeFrame: vi.fn(() => Promise.resolve(ok({ jpeg_b64: 'AAAA', ts: 7, age_s: 0 }))),
      submitBrief: vi.fn(() => Promise.resolve(ok({ submitted: 'b-new', inbox: 'x' }))),
      cancelBrief: vi.fn(() => Promise.resolve(ok({ brief_id: 'b-evolve', requested: true }))),
      renderView: vi.fn((id: string) => <div>view:{id}</div>),
      t,
      ...over,
    }
  }
  const mount = (p: ReturnType<typeof props>) =>
    render(<RsiView {...(p as unknown as Parameters<typeof RsiView>[0])} />)
  /** The campaign row's task cell: the first table on the page is the campaign
   * list, and the task name also shows in the status card once one is picked. */
  const row = (container: HTMLElement, task: string) =>
    within(container.querySelector('table') as HTMLElement).getByRole('cell', { name: task })

  it('lists campaigns, then tells the picked one in loop order: chart, round beats, clips, log', async () => {
    const p = props()
    const { container } = mount(p)
    await waitFor(() => { expect(row(container, 'kitchen_thaw')).toBeTruthy() })
    expect(p.fetchRsiRun).toHaveBeenCalledWith('session-main', 'pack_lunch')
    expect(screen.queryByText('pack_lunch')).toBeNull()
    // The task picker offers the cards' task_bindings as a native datalist.
    expect(container.querySelectorAll('datalist option')).toHaveLength(2)
    // The running campaign auto-selects: its status card and an enabled Stop are
    // up before any click, and its task is already in the input.
    await waitFor(() => { expect(screen.getByTestId('rsi-status')).toBeTruthy() })
    expect(screen.getByTestId('rsi-status').textContent).toContain('kitchen_thaw')
    expect((screen.getByPlaceholderText(en['evolve.taskHint']) as HTMLInputElement).value).toBe('kitchen_thaw')
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(row(container, 'kitchen_thaw'))
    await waitFor(() => { expect(container.querySelectorAll('polyline')).toHaveLength(3) })
    expect(p.fetchRsiSeries).toHaveBeenCalledWith('session-main', 'kitchen_thaw')
    // Chart: y ticks 0..3 (seed count), one x label per round, a three-entry legend.
    expect([...container.querySelectorAll('text[data-axis="y"]')].map(e => e.textContent)).toEqual(['0', '1', '2', '3'])
    expect([...container.querySelectorAll('text[data-axis="x"]')].map(e => e.textContent)).toEqual(['Round 1', 'Round 2'])
    expect(container.querySelectorAll('[data-legend]')).toHaveLength(3)
    expect(container.querySelector('polyline[data-series="best"]')?.getAttribute('points')).toMatch(/^26,[\d.]+ 312,[\d.]+$/)
    // Status card: task, status chip, best; this campaign predates live progress.
    const status = screen.getByTestId('rsi-status')
    expect(status.textContent).toContain('best 2/3')
    expect(status.querySelector('[data-status="running"]')?.textContent).toBe(en['rsi.status.running'])
    expect(screen.getByText(en['rsi.noLive'])).toBeTruthy()
    expect(container.querySelector('[aria-current="step"]')).toBeNull()
    // The selected campaign's task is prefilled for 继续.
    expect((screen.getByPlaceholderText(en['evolve.taskHint']) as HTMLInputElement).value).toBe('kitchen_thaw')
    // Timeline: one chip per finished round, none dashed; the latest is selected.
    const chips = container.querySelectorAll('button[aria-pressed]')
    expect(chips).toHaveLength(2)
    expect(container.querySelector('button[data-running="true"]')).toBeNull()
    expect(chips[1]?.getAttribute('aria-pressed')).toBe('true')
    // Round 2 (latest) card: tried nothing, so its needs list shows.
    expect(screen.getAllByText(en['rsi.saw'])).toHaveLength(1)
    expect(screen.getByText('tunables on grasp · proposal')).toBeTruthy()
    expect(screen.getByText('2 → 2 (best 2)')).toBeTruthy()
    // Log: humanized lines filtered to the evolve brief; raw JSON behind the toggle.
    expect(screen.getByText('claimed the evolve of kitchen_thaw b-evolve')).toBeTruthy()
    expect(screen.getByText('Round 1 · rsi_round')).toBeTruthy()
    expect(container.querySelector('time')?.textContent).toMatch(/^(\d\d:\d\d:\d\d|--:--:--)$/)
    expect(container.querySelector('pre')).toBeNull()
    fireEvent.click(screen.getByLabelText(en['rsi.log.raw']))
    const log = container.querySelector('pre')?.textContent ?? ''
    expect(log).toContain('"brief":"b-evolve"')
    expect(log).not.toContain('b-other')
    // Round 2 has no media; picking round 1 on the timeline shows its four beats, frames and dropped reasons.
    expect(screen.getByText(en['evolve.noMedia'])).toBeTruthy()
    fireEvent.click(chips[0] as Element)
    expect(screen.getByText('reach_stall')).toBeTruthy()
    expect(screen.getAllByText('grasp-0: switch executor to pi05').length).toBeGreaterThan(0)
    expect(screen.getByText('1 → 2 (best 2)')).toBeTruthy()
    expect(screen.getByText(en.yes)).toBeTruthy()
    expect(screen.queryByText(en['rsi.needs'])).toBeNull()
    // An .mp4 path becomes a muted, metadata-only <video> off the board's byte route, captioned by node.
    await waitFor(() => { expect(container.querySelector('video')).toBeTruthy() })
    const video = container.querySelector('video') as HTMLVideoElement
    expect(video.getAttribute('src')).toBe('/api/board/media/session-main/media/kitchen_thaw/1/grasp-0.mp4')
    expect(video.hasAttribute('controls')).toBe(true)
    expect(video.getAttribute('preload')).toBe('metadata')
    expect(container.querySelector('figcaption')?.textContent).toBe('grasp-0')
    expect(p.fetchRsiFrames).toHaveBeenCalledWith('session-main', 'kitchen_thaw', 1)
    expect(screen.getByText(/verify_failed/)).toBeTruthy()
    // The brief is open (claimed, no terminal marker): Stop cancels it.
    fireEvent.click(screen.getByRole('button', { name: en['evolve.stop'] }))
    await waitFor(() => { expect(p.cancelBrief).toHaveBeenCalledWith('b-evolve', 'session-main') })
  })

  it('shows the live round: stepper phase, seed board, elapsed, the dashed running chip, the frame', async () => {
    const live = {
      phase: 'retest', round: 3, seeds_total: 3, seed_index: 2, seed: 2, node: 'grasp-0',
      started_at: Date.now() / 1000 - 400, round_started_at: Date.now() / 1000 - 90, phase_started_at: Date.now() / 1000 - 10,
      last_round_s: 150, per_seed_partial: [{ seed: 1, success: true, first_death: null, failure_mode: null }],
      tried: { kind: 'tunables', node: 'grasp-0', detail: { path: ['reach_tol'], from: 0.03, to: 0.036 } }, message: 'retesting seed 2',
    }
    const p = props({ fetchRsiRun: vi.fn((_s: string, task: string) => Promise.resolve(ok(task === 'kitchen_thaw' ? { ...campaign, live } : null))) })
    const { container } = mount(p)
    await waitFor(() => { expect(row(container, 'kitchen_thaw')).toBeTruthy() })
    fireEvent.click(row(container, 'kitchen_thaw'))
    await waitFor(() => { expect(container.querySelector('[aria-current="step"]')).toBeTruthy() })
    expect(container.querySelector('[aria-current="step"]')?.getAttribute('data-phase')).toBe('retest')
    expect(screen.getByTestId('rsi-status').textContent).toContain('Round 3')
    expect(screen.getByText('Seed 2/3 · seed 2 · node grasp-0')).toBeTruthy()
    expect(screen.getByTestId('rsi-elapsed').textContent).toMatch(/^Elapsed 1m · ETA 1m$/)
    expect(screen.getByText('retesting seed 2')).toBeTruthy()
    // Seed board: seeds 1..3 → ✓ / running / queued.
    const states = [...container.querySelectorAll('[data-state]')].map(e => e.getAttribute('data-state'))
    expect(states).toEqual(['pass', 'running', 'queued'])
    // Timeline: two finished rounds plus the dashed running one.
    expect(container.querySelectorAll('button[aria-pressed]')).toHaveLength(3)
    expect(container.querySelector('button[data-running="true"]')?.textContent).toContain('Round 3')
    // The live frame polls runtimeFrame and lands in the <img>.
    await waitFor(() => { expect(p.fetchRuntimeFrame).toHaveBeenCalledWith('session-main', 0) })
    await waitFor(() => { expect((container.querySelector('img') as HTMLImageElement).src).toBe('data:image/jpeg;base64,AAAA') })
  })

  it('renders a failed seed with its first death and mode, and no ETA on the first round', async () => {
    const live = {
      phase: 'baseline', round: 1, seeds_total: 3, seed_index: 3, seed: 3, node: 'place-0', round_started_at: Date.now() / 1000 - 5, last_round_s: null,
      per_seed_partial: [{ seed: 1, success: false, first_death: 'grasp-0', failure_mode: 'reach_stall' }, { seed: 2, success: true }],
    }
    const p = props({ fetchRsiRun: vi.fn((_s: string, task: string) => Promise.resolve(ok(task === 'kitchen_thaw' ? { ...campaign, live } : null))) })
    const { container } = mount(p)
    await waitFor(() => { expect(row(container, 'kitchen_thaw')).toBeTruthy() })
    fireEvent.click(row(container, 'kitchen_thaw'))
    await waitFor(() => { expect(container.querySelector('[data-state="fail"]')).toBeTruthy() })
    expect(container.querySelector('[data-state="fail"]')?.textContent).toBe('1 ✗ died at grasp-0 (reach_stall)')
    expect(screen.getByTestId('rsi-elapsed').textContent).toContain(en['rsi.etaNone'])
  })

  it('tells the operator how to begin when no campaign is picked', async () => {
    mount(props({ fetchRuntimeEvents: vi.fn(() => Promise.resolve(ok({ events: [], last_seq: 0 }))) }))
    await waitFor(() => { expect(screen.getByText(en['rsi.guide'])).toBeTruthy() })
  })

  it('keeps the strict-evaluation block collapsed, then renders the legacy views by id', async () => {
    const p = props()
    const { container } = mount(p)
    await waitFor(() => { expect(row(container, 'kitchen_thaw')).toBeTruthy() })
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
    const { container } = mount(p)
    await waitFor(() => { expect(row(container, 'kitchen_thaw')).toBeTruthy() })
    // The campaign auto-selected, but its brief was cancelled: nothing to stop.
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(true)
    const input = screen.getByPlaceholderText(en['evolve.taskHint']) as HTMLInputElement
    expect(input.value).toBe('kitchen_thaw')
    const start = screen.getByRole('button', { name: en['evolve.start'] }) as HTMLButtonElement
    // Clear it: Start needs a task name, whatever the table shows.
    fireEvent.change(input, { target: { value: '' } })
    expect(start.disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'pack_lunch' } })
    expect(start.disabled).toBe(false)
    fireEvent.click(start)
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledWith('{"kind":"evolve","task":"pack_lunch"}', 'session-main') })
    // Resume = pick the campaign (prefills its task) and press the same button.
    fireEvent.click(row(container, 'kitchen_thaw'))
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: en['evolve.start'] }))
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledWith('{"kind":"evolve","task":"kitchen_thaw"}', 'session-main') })
    expect(p.cancelBrief).not.toHaveBeenCalled()
  })
})

describe('describeEvent', () => {
  it('words the board markers; unknown kinds show verbatim', () => {
    const tt = t as unknown as Parameters<typeof describeEvent>[1]
    expect(describeEvent({ kind: 'task_failed', error: 'boom' }, tt)).toBe('failed: boom')
    expect(describeEvent({ kind: 'task_cancelled' }, tt)).toBe('cancelled')
    expect(describeEvent({ kind: 'rsi_step', round: 2, message: 'seed 1 ok' }, tt)).toBe('Round 2 · rsi_step seed 1 ok')
    expect(describeEvent({ kind: 'boot' }, tt)).toBe('boot')
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
