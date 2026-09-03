// @vitest-environment jsdom
/**
 * RSI page: it lists campaigns off rsiCampaigns (so the list survives a
 * restart's empty feed), draws the rsiSeries chart as inline SVG, tells one
 * round in its four beats (看到了什么 / 试了什么 / 结果 / 发布), filters the
 * runtime feed to this brief's lines into a log folded unless the campaign
 * failed, starts a campaign with a task-only brief, stops the campaign's
 * open_brief through cancelBrief, and renders the strict-evaluation block only
 * when legacy stores exist.
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
    best: 2, cursor: 2, open_brief: 'b-evolve',
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
  /** The `rsiCampaigns` rows: the running one first, a settled one after. */
  const campaigns = [
    { task: 'kitchen_thaw', status: 'running', cursor: 2, rounds: 2, best: 2, seeds: [1, 3], arm: 'auto', updated: 20, live: null, open_brief: 'b-evolve' },
    { task: 'pack_lunch', status: 'done', cursor: 1, rounds: 1, best: 1, seeds: [1, 2], arm: 'auto', updated: 10, live: null, open_brief: null },
  ]
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
      fetchStores: vi.fn(() => Promise.resolve(ok([]))),
      fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok(campaigns))),
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
  /** One campaign chip by task name. */
  const chip = (task: string) => within(screen.getByTestId('rsi-campaigns')).getByRole('button', { name: new RegExp(`^${task} ·`) })
  const roundChips = () => within(screen.getByTestId('rsi-rounds')).queryAllByRole('button')
  const log = () => screen.getByTestId('rsi-log') as HTMLDetailsElement

  it('lists campaigns off rsiCampaigns, then tells the picked one: strip, round beats, clips, folded log', async () => {
    const p = props()
    const { container } = mount(p)
    await waitFor(() => { expect(chip('kitchen_thaw')).toBeTruthy() })
    expect(p.fetchRsiCampaigns).toHaveBeenCalledWith('session-main')
    // Chips carry the headline; the settled campaign is listed too, unselected.
    expect(chip('kitchen_thaw').textContent).toBe('kitchen_thaw · Round 2 · best 2/3 · running')
    expect(chip('pack_lunch').getAttribute('aria-pressed')).toBe('false')
    // The task picker offers the cards' task_bindings as a native datalist.
    expect(container.querySelectorAll('datalist option')).toHaveLength(2)
    // The first row (running) auto-selects: its task is in the input, Stop is
    // enabled off open_brief, and rsiRun is read for it alone.
    await waitFor(() => { expect(chip('kitchen_thaw').getAttribute('aria-pressed')).toBe('true') })
    expect((screen.getByPlaceholderText(en['evolve.taskHint']) as HTMLInputElement).value).toBe('kitchen_thaw')
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(false)
    await waitFor(() => { expect(container.querySelectorAll('polyline')).toHaveLength(3) })
    expect(p.fetchRsiRun).toHaveBeenCalledWith('session-main', 'kitchen_thaw')
    expect(p.fetchRsiRun).not.toHaveBeenCalledWith('session-main', 'pack_lunch')
    expect(p.fetchRsiSeries).toHaveBeenCalledWith('session-main', 'kitchen_thaw')
    // Chart: y ticks 0..3 (seed count), one x label per round, a three-entry legend.
    expect([...container.querySelectorAll('text[data-axis="y"]')].map(e => e.textContent)).toEqual(['0', '1', '2', '3'])
    expect([...container.querySelectorAll('text[data-axis="x"]')].map(e => e.textContent)).toEqual(['Round 1', 'Round 2'])
    expect(container.querySelectorAll('[data-legend]')).toHaveLength(3)
    expect(container.querySelector('polyline[data-series="best"]')?.getAttribute('points')).toMatch(/^26,[\d.]+ 312,[\d.]+$/)
    // Status card: this running campaign predates live progress — it says so and nothing more (the chip has the rest).
    const status = screen.getByTestId('rsi-status')
    expect(status.textContent).toBe(en['rsi.noLive'])
    expect(container.querySelector('[aria-current="step"]')).toBeNull()
    // Round strip: one chip per finished round, none dashed; the latest is selected.
    const chips = roundChips()
    expect(chips).toHaveLength(2)
    expect(container.querySelector('button[data-running="true"]')).toBeNull()
    expect(chips[1]?.getAttribute('aria-pressed')).toBe('true')
    // Round 2 (latest) card: tried nothing, so its needs list shows.
    expect(screen.getAllByText(en['rsi.saw'])).toHaveLength(1)
    expect(screen.getByText('tunables on grasp · proposal')).toBeTruthy()
    expect(screen.getByText('2 → 2 (best 2)')).toBeTruthy()
    // Log: folded (the campaign runs fine), humanized lines filtered to the evolve brief; raw JSON behind the toggle.
    expect(log().open).toBe(false)
    expect(screen.getByText('claimed the evolve of kitchen_thaw b-evolve')).toBeTruthy()
    expect(screen.getByText('Round 1 · rsi_round')).toBeTruthy()
    expect(container.querySelector('time')?.textContent).toMatch(/^(\d\d:\d\d:\d\d|--:--:--)$/)
    expect(container.querySelector('pre')).toBeNull()
    fireEvent.click(screen.getByLabelText(en['rsi.log.raw']))
    const raw = container.querySelector('pre')?.textContent ?? ''
    expect(raw).toContain('"brief":"b-evolve"')
    expect(raw).not.toContain('b-other')
    // No legacy stores: the strict block is not rendered at all.
    expect(screen.queryByText(en['rsi.strict'])).toBeNull()
    // Round 2 has no media; picking round 1 on the strip shows its four beats, frames and dropped reasons.
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
    // Stop cancels the campaign's open_brief.
    fireEvent.click(screen.getByRole('button', { name: en['evolve.stop'] }))
    await waitFor(() => { expect(p.cancelBrief).toHaveBeenCalledWith('b-evolve', 'session-main') })
  })

  it('keeps the list (and Stop) after a restart emptied the runtime feed', async () => {
    const p = props({ fetchRuntimeEvents: vi.fn(() => Promise.resolve(ok({ events: [], last_seq: 0 }))) })
    mount(p)
    await waitFor(() => { expect(chip('kitchen_thaw').getAttribute('aria-pressed')).toBe('true') })
    expect(chip('pack_lunch')).toBeTruthy()
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(en['evolve.noLog'])).toBeTruthy()
    expect(log().open).toBe(false)
  })

  it('opens the log on its own when the campaign failed or was cancelled; no status card once settled', async () => {
    const p = props({
      fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok([{ ...campaigns[0], status: 'cancelled', open_brief: null }]))),
      fetchRsiRun: vi.fn(() => Promise.resolve(ok({ ...campaign, status: 'cancelled', open_brief: null }))),
      fetchRuntimeEvents: vi.fn(() => Promise.resolve(ok({ events: [...events, { seq: 6, kind: 'task_failed', brief: 'b-evolve', error: 'boom' }], last_seq: 6 }))),
    })
    mount(p)
    await waitFor(() => { expect(chip('kitchen_thaw').textContent).toContain('cancelled') })
    await waitFor(() => { expect(log().open).toBe(true) })
    expect(screen.getByText('failed: boom')).toBeTruthy()
    expect(screen.queryByTestId('rsi-status')).toBeNull()
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(true)
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
    await waitFor(() => { expect(container.querySelector('[aria-current="step"]')).toBeTruthy() })
    expect(container.querySelector('[aria-current="step"]')?.getAttribute('data-phase')).toBe('retest')
    expect(screen.getByTestId('rsi-status').textContent).toContain('Round 3')
    expect(screen.getByText('Seed 2/3 · seed 2 · node grasp-0')).toBeTruthy()
    expect(screen.getByTestId('rsi-elapsed').textContent).toMatch(/^Elapsed 1m · ETA 1m$/)
    expect(screen.getByText('retesting seed 2')).toBeTruthy()
    // Seed board: seeds 1..3 → ✓ / running / queued.
    const states = [...container.querySelectorAll('[data-state]')].map(e => e.getAttribute('data-state'))
    expect(states).toEqual(['pass', 'running', 'queued'])
    // Round strip: two finished rounds plus the dashed running one.
    expect(roundChips()).toHaveLength(3)
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
    await waitFor(() => { expect(container.querySelector('[data-state="fail"]')).toBeTruthy() })
    expect(container.querySelector('[data-state="fail"]')?.textContent).toBe('1 ✗ died at grasp-0 (reach_stall)')
    expect(screen.getByTestId('rsi-elapsed').textContent).toContain(en['rsi.etaNone'])
  })

  it('renders the running seed\'s node chips in plan order, and the last 8 messages newest last', async () => {
    const nodes = [
      { id: 'reach-0', skill: 'reach', ok: true, steps: 40 },
      { id: 'grasp-0', skill: 'grasp', ok: false, steps: 12, failure_mode: 'reach_stall' },
      { id: 'lift-0', skill: 'lift', ok: null },
      { id: 'place-0', skill: 'place', ok: null },
    ]
    const messages = Array.from({ length: 10 }, (_, i) => ({ ts: 1000 + i, text: `line ${i}` }))
    const live = { phase: 'baseline', round: 1, seeds_total: 3, seed_index: 1, seed: 1, node: 'lift-0', round_started_at: Date.now() / 1000 - 5, nodes, messages }
    const p = props({ fetchRsiRun: vi.fn((_s: string, task: string) => Promise.resolve(ok(task === 'kitchen_thaw' ? { ...campaign, live } : null))) })
    const { container } = mount(p)
    await waitFor(() => { expect(screen.getByTestId('rsi-nodes')).toBeTruthy() })
    const chips = [...screen.getByTestId('rsi-nodes').querySelectorAll('[data-state]')]
    expect(chips.map(e => e.getAttribute('data-state'))).toEqual(['pass', 'fail', 'running', 'queued'])
    expect(chips.map(e => e.textContent)).toEqual(['✓ reach-040 steps', '✗ grasp-0reach_stall', '● lift-0', '○ place-0'])
    // Messages: 10 in the block, the last 8 shown oldest → newest.
    const lines = [...screen.getByTestId('rsi-messages').querySelectorAll('span')].map(e => e.textContent)
    expect(lines).toEqual(messages.slice(-8).map(m => m.text))
    expect(container.querySelector('[data-testid="rsi-messages"] time')?.textContent).toMatch(/^\d\d:\d\d:\d\d$/)
  })

  it('draws the running seed as a plan graph once nodes carry after edges: running node pulses, recovery nodes dashed', async () => {
    const nodes = [
      { id: 'reach-0', skill: 'reach', ok: true, steps: 40 },
      { id: 'grasp-0', skill: 'grasp', ok: null, after: ['reach-0'] },
      { id: 'regrasp-0', skill: 'grasp', kind: 'recovery', ok: null, after: ['grasp-0'] },
      { id: 'place-0', skill: 'place', ok: null, after: ['grasp-0', 'regrasp-0'] },
    ]
    const live = { phase: 'baseline', round: 1, seeds_total: 3, seed_index: 1, seed: 1, node: 'grasp-0', round_started_at: Date.now() / 1000 - 5, nodes, messages: [] }
    const p = props({ fetchRsiRun: vi.fn((_s: string, task: string) => Promise.resolve(ok(task === 'kitchen_thaw' ? { ...campaign, live } : null))) })
    mount(p)
    await waitFor(() => { expect(screen.getByTestId('rsi-nodes')).toBeTruthy() })
    const g = screen.getByTestId('rsi-nodes')
    const els = [...g.querySelectorAll('[data-node]')]
    expect(els.map(e => e.getAttribute('data-state'))).toEqual(['pass', 'running', 'queued', 'queued'])
    expect(els.map(e => e.getAttribute('data-kind'))).toEqual([null, null, 'recovery', null])
    expect(g.querySelectorAll('[data-edge="after"]').length).toBe(4)
    expect(g.querySelectorAll('[data-changed]').length).toBe(0)
    expect(g.querySelector('svg')?.getAttribute('height')).toMatch(/^\d+/)
    expect(screen.getByText(en['rsi.graph.legend'])).toBeTruthy()
  })

  it('collapses the messages to the latest line when the campaign is not running, and hides empty node chips', async () => {
    const live = { phase: 'baseline', round: 1, nodes: [], messages: [{ ts: 1, text: 'a' }, { ts: 2, text: 'b' }] }
    const p = props({
      fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok(campaigns.map(c => ({ ...c, status: 'done' }))))),
      fetchRsiRun: vi.fn((_s: string, task: string) => Promise.resolve(ok(task === 'kitchen_thaw' ? { ...campaign, status: 'done', live } : null))),
    })
    mount(p)
    await waitFor(() => { expect(screen.getByTestId('rsi-messages')).toBeTruthy() })
    expect([...screen.getByTestId('rsi-messages').querySelectorAll('span')].map(e => e.textContent)).toEqual(['b'])
    expect(screen.queryByTestId('rsi-nodes')).toBeNull()
  })

  it('shows the round as one plan graph per seed once rows carry nodes: 基线 and 试探 side by side, changed nodes outlined', async () => {
    const base = [
      { seed: 1, success: false, elapsed_s: 42, nodes: [{ id: 'reach-0', ok: true, steps: 40 }, { id: 'grasp-0', ok: false, steps: 12, failure_mode: 'reach_stall', after: ['reach-0'] }, { id: 'place-0', ok: null, after: ['grasp-0'] }] },
      { seed: 2, success: true, elapsed_s: 100, nodes: [{ id: 'reach-0', ok: true, steps: 38 }, { id: 'grasp-0', ok: true, steps: 20, after: ['reach-0'] }, { id: 'place-0', ok: true, steps: 30, after: ['grasp-0'] }] },
    ]
    const trial = [
      { seed: 1, success: true, elapsed_s: 61, nodes: [{ id: 'reach-0', ok: true, steps: 40 }, { id: 'grasp-0', ok: true, steps: 15, after: ['reach-0'] }, { id: 'place-0', ok: true, steps: 33, after: ['grasp-0'] }] },
      { seed: 2, success: true, elapsed_s: 99, nodes: [{ id: 'reach-0', ok: true, steps: 38 }, { id: 'grasp-0', ok: true, steps: 20, after: ['reach-0'] }, { id: 'place-0', ok: true, steps: 30, after: ['grasp-0'] }] },
    ]
    const rounds = [{ ...campaign.rounds[0], per_seed: base, after_seeds: trial }]
    const p = props({ fetchRsiRun: vi.fn((_s: string, task: string) => Promise.resolve(ok(task === 'kitchen_thaw' ? { ...campaign, rounds, latest: rounds[0] } : null))) })
    mount(p)
    await waitFor(() => { expect(screen.getByTestId('rsi-seed-graphs')).toBeTruthy() })
    const heads = [...screen.getByTestId('rsi-seed-graphs').querySelectorAll('[data-seed]')].map(e => e.firstElementChild?.textContent)
    expect(heads).toEqual(['Seed 1 · 42s', 'Seed 2 · 1m'])
    const states = (id: string) => [...screen.getByTestId(id).querySelectorAll('[data-node]')].map(e => `${e.getAttribute('data-node')}:${e.getAttribute('data-state')}${e.getAttribute('data-changed') === 'true' ? '!' : ''}`)
    // One node element per entry, its state class, edges == sum(after); seed 1's grasp-0 / place-0 differ between 基线 and 试探.
    expect(states('rsi-graph-1-base')).toEqual(['reach-0:pass', 'grasp-0:fail!', 'place-0:queued!'])
    expect(states('rsi-graph-1-trial')).toEqual(['reach-0:pass', 'grasp-0:pass!', 'place-0:pass!'])
    expect(states('rsi-graph-2-base')).toEqual(['reach-0:pass', 'grasp-0:pass', 'place-0:pass'])
    expect(screen.getByTestId('rsi-graph-1-base').querySelectorAll('[data-edge="after"]').length).toBe(2)
    expect(screen.getByTestId('rsi-graph-1-base').querySelector('[data-state="fail"] title')?.textContent).toBe('✗ · 12 steps · reach_stall')
    expect(screen.getByTestId('rsi-graph-1-base').querySelector('[data-state="fail"] text:last-child')?.textContent).toBe('reach_stall')
    // The plain per-seed table is gone.
    expect(screen.queryByText(en['rsi.firstDeath'])).toBeNull()
  })

  it('tells the operator how to begin when the session holds no campaign', async () => {
    mount(props({ fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok([]))) }))
    await waitFor(() => { expect(screen.getByText(en['rsi.guide'])).toBeTruthy() })
    expect(screen.queryByTestId('rsi-campaigns')).toBeNull()
  })

  it('renders the strict-evaluation block only when legacy stores exist, collapsed, then the legacy views by id', async () => {
    const p = props({ fetchStores: vi.fn(() => Promise.resolve(ok([{ name: 'rsi-kitchen', generations: 4, promoted: 1 }]))) })
    mount(p)
    await waitFor(() => { expect(screen.getByText(en['rsi.strictNote'])).toBeTruthy() })
    const details = screen.getByText(en['rsi.strictNote']).closest('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    fireEvent.click(details.querySelector('summary') as HTMLElement)
    expect(details.open).toBe(true)
    expect(screen.getByText('view:rsi-strict')).toBeTruthy()
    expect(screen.getByText('view:evolution')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: en['rsi.tab.battle'] }))
    expect(screen.getByText('view:battle')).toBeTruthy()
  })

  it('needs a task to start, then submits the task-only evolve brief; stop is disabled with no open brief', async () => {
    const p = props({
      fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok(campaigns.map(c => ({ ...c, open_brief: null }))))),
    })
    mount(p)
    await waitFor(() => { expect(chip('kitchen_thaw').getAttribute('aria-pressed')).toBe('true') })
    // The campaign auto-selected, but no brief drives it: nothing to stop.
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(true)
    const input = screen.getByPlaceholderText(en['evolve.taskHint']) as HTMLInputElement
    expect(input.value).toBe('kitchen_thaw')
    const start = screen.getByRole('button', { name: en['evolve.start'] }) as HTMLButtonElement
    // Clear it: Start needs a task name, whatever the chips show.
    fireEvent.change(input, { target: { value: '' } })
    expect(start.disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'new_task' } })
    expect(start.disabled).toBe(false)
    fireEvent.click(start)
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledWith('{"kind":"evolve","task":"new_task"}', 'session-main') })
    // Resume = pick the campaign chip (prefills its task) and press the same button.
    fireEvent.click(chip('pack_lunch'))
    expect(input.value).toBe('pack_lunch')
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: en['evolve.start'] }))
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledWith('{"kind":"evolve","task":"pack_lunch"}', 'session-main') })
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
