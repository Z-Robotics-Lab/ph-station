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
import { RsiView, SeriesChart, TaskHeat, confirmLine, describeEvent, describeTried, fmtNum, roundSummary, treeLayout, usageLine } from '../src/client/RsiView.tsx'
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
        proposer: 'llm', llm: { summary: 'grasp-0 stalls on seed 2', rationale: 'pi05 handles reach better', model: 'deepseek-chat', prompt_sha: 'abc' },
        before: 1, after: 2, best: 2, published: true, media: ['media/kitchen_thaw/1/grasp-0.mp4'],
        per_seed: [{ seed: 1, success: true, first_death: null, failure_mode: null }, { seed: 2, success: false, first_death: 'grasp-0', failure_mode: 'reach_stall' }, { seed: 3, success: true, first_death: null, failure_mode: null }],
        needs: [], media_dropped: { '2/grasp-0': { reason: 'verify_failed', keyframes: ['media/kitchen_thaw/2/grasp-0-000.jpg'] } }, parent: 0, outcome: 'improved',
        confirm: { seeds: [4247, 4248], before: 0, after: 1 }, usage: { llm_tokens: { prompt: 1000, completion: 234 }, sim_s: 163.6 } },
      { round: 2, tried: { kind: 'none', node: 'grasp-0', detail: { reason: 'no untried executor', needs: ['tunables on grasp', 'proposal'] } },
        proposer: 'rules', before: 2, after: 2, best: 2, published: false, media: [], per_seed: [], needs: ['tunables on grasp', 'proposal'], media_dropped: {},
        parent: 1, outcome: 'none', confirm: null, usage: { llm_tokens: null, sim_s: 12 } },
    ],
    latest: { round: 2, tried: { kind: 'none', node: 'grasp-0', detail: { reason: 'no untried executor' } }, before: 2, after: 2, best: 2, media: [] },
  }
  /** The `rsiCampaigns` rows: the running one first, a settled one after. */
  const campaigns = [
    { task: 'kitchen_thaw', status: 'running', cursor: 2, rounds: 2, best: 2, seeds: [1, 3], arm: 'auto', updated: 20, live: null, open_brief: 'b-evolve',
      published_rounds: 1, usage: { llm_tokens: { prompt: 1000, completion: 234 }, sim_s: 175.6 } },
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
      fetchRsiFrames: vi.fn((_s: string, _t: string, round: number) => Promise.resolve(ok(round === 1
        ? { media: ['media/kitchen_thaw/1/grasp-0.mp4'], dropped: { '2/grasp-0': { reason: 'verify_failed', keyframes: ['media/kitchen_thaw/2/grasp-0-000.jpg', 'media/kitchen_thaw/2/grasp-0-001.jpg', 'media/kitchen_thaw/2/grasp-0-002.jpg', 'media/kitchen_thaw/2/grasp-0-003.jpg'] } } }
        : []))),
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
    expect(chip('kitchen_thaw').textContent).toBe('kitchen_thaw · Round 2 · best 2/3 · running · LLM tokens 1.2k · sim 176 s')
    expect(chip('pack_lunch').getAttribute('aria-pressed')).toBe('false')
    // The task picker offers the cards' task_bindings as a native datalist.
    expect(container.querySelectorAll('datalist option')).toHaveLength(2)
    // The first row (running) auto-selects: its task is in the input, Stop is
    // enabled off open_brief, and rsiRun is read for it alone.
    await waitFor(() => { expect(chip('kitchen_thaw').getAttribute('aria-pressed')).toBe('true') })
    expect((screen.getByPlaceholderText(en['evolve.taskHint']) as HTMLInputElement).value).toBe('kitchen_thaw')
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(false)
    await waitFor(() => { expect(container.querySelectorAll('polyline')).toHaveLength(4) })
    expect(p.fetchRsiRun).toHaveBeenCalledWith('session-main', 'kitchen_thaw')
    expect(p.fetchRsiRun).not.toHaveBeenCalledWith('session-main', 'pack_lunch')
    expect(p.fetchRsiSeries).toHaveBeenCalledWith('session-main', 'kitchen_thaw')
    // Chart: a 0–100% axis, one x label per round, a three-entry legend; rows without node_rate fall back to k/n·100.
    expect([...container.querySelectorAll('text[data-axis="y"]')].map(e => e.textContent)).toEqual(['0%', '25%', '50%', '75%', '100%'])
    expect([...container.querySelectorAll('text[data-axis="x"]')].map(e => e.textContent)).toEqual(['Round 1', 'Round 2'])
    expect(container.querySelectorAll('[data-legend]')).toHaveLength(3)
    expect(container.querySelector('polyline[data-series="best"]')?.getAttribute('points')).toMatch(/^26,[\d.]+ 312,[\d.]+$/)
    // No by_task on these rows: no heat strip; the round card carries no summary line either.
    expect(screen.queryByTestId('rsi-heat')).toBeNull()
    expect(screen.queryByTestId('rsi-round-summary')).toBeNull()
    // Status card: this running campaign predates live progress — it says so and nothing more (the chip has the rest).
    const status = screen.getByTestId('rsi-status')
    expect(status.textContent).toBe(en['rsi.noLive'])
    expect(container.querySelector('[aria-current="step"]')).toBeNull()
    // Hypothesis tree: one node per finished round, none dashed; the latest is selected.
    const chips = roundChips()
    expect(chips).toHaveLength(2)
    expect(container.querySelector('[data-running="true"]')).toBeNull()
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
    // The dropped node shows its reason and at most three keyframe stills off the byte route.
    const dropped = screen.getByTestId('rsi-dropped')
    expect(dropped.getAttribute('data-node')).toBe('2/grasp-0')
    expect([...dropped.querySelectorAll('img')].map(i => i.getAttribute('src'))).toEqual([
      '/api/board/media/session-main/media/kitchen_thaw/2/grasp-0-000.jpg',
      '/api/board/media/session-main/media/kitchen_thaw/2/grasp-0-001.jpg',
      '/api/board/media/session-main/media/kitchen_thaw/2/grasp-0-002.jpg',
    ])
    // Round 1's card: the 确认 beat and the usage line.
    expect(screen.getByTestId('rsi-confirm').textContent).toBe(`${en['rsi.confirm']}Confirm seeds 4247,4248 · 0/2 → 1/2 · passed`)
    expect(screen.getByTestId('rsi-usage').textContent).toBe('LLM tokens 1.2k · sim 164 s')
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
    // Tree: two finished rounds plus the dashed running one, in round 1's lane (the last published).
    expect(roundChips()).toHaveLength(3)
    const runningNode = container.querySelector('[data-running="true"]') as HTMLElement
    expect(runningNode.getAttribute('title')).toBe('Round 3 · grasp-0: reach_tol 0.03 → 0.036 · — → —')
    expect(runningNode.getAttribute('data-lane')).toBe('1')
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

  it('shows the round as a seed × node matrix once rows carry nodes: 基线 and 试探 side by side, changed cells marked', async () => {
    const base = [
      { seed: 1, success: false, elapsed_s: 42, nodes: [{ id: 'reach-0', ok: true, steps: 40 }, { id: 'grasp-0', ok: false, steps: 12, failure_mode: 'reach_stall' }, { id: 'place-0', ok: null }] },
      { seed: 2, success: true, elapsed_s: 100, nodes: [{ id: 'reach-0', ok: true, steps: 38 }, { id: 'grasp-0', ok: true, steps: 20 }, { id: 'place-0', ok: true, steps: 30 }] },
    ]
    const trial = [
      { seed: 1, success: true, elapsed_s: 61, nodes: [{ id: 'reach-0', ok: true, steps: 40 }, { id: 'grasp-0', ok: true, steps: 15 }, { id: 'place-0', ok: true, steps: 33 }] },
      { seed: 2, success: true, elapsed_s: 99, nodes: [{ id: 'reach-0', ok: true, steps: 38 }, { id: 'grasp-0', ok: true, steps: 20 }, { id: 'place-0', ok: true, steps: 30 }] },
    ]
    const rounds = [{ ...campaign.rounds[0], per_seed: base, after_seeds: trial }]
    const p = props({ fetchRsiRun: vi.fn((_s: string, task: string) => Promise.resolve(ok(task === 'kitchen_thaw' ? { ...campaign, rounds, latest: rounds[0] } : null))) })
    mount(p)
    await waitFor(() => { expect(screen.getByTestId('rsi-matrix-Baseline')).toBeTruthy() })
    const cells = (id: string) => [...screen.getByTestId(id).querySelectorAll('tbody td')].map(e => e.textContent)
    expect([...screen.getByTestId('rsi-matrix-Baseline').querySelectorAll('th')].map(e => e.textContent)).toEqual(['Seed', 'reach-0', 'grasp-0', 'place-0', 'Elapsed'])
    expect(cells('rsi-matrix-Baseline')).toEqual(['1', '✓', '✗', '–', '42s', '2', '✓', '✓', '✓', '1m'])
    expect(cells('rsi-matrix-Trial')).toEqual(['1', '✓', '✓', '✓', '1m', '2', '✓', '✓', '✓', '1m'])
    // Seed 1's grasp-0 and place-0 changed between baseline and trial; both matrices mark them, nothing else.
    const changed = (id: string) => [...screen.getByTestId(id).querySelectorAll('td[data-changed="true"]')].map(e => e.textContent)
    expect(changed('rsi-matrix-Baseline')).toEqual(['✗', '–'])
    expect(changed('rsi-matrix-Trial')).toEqual(['✓', '✓'])
    expect(screen.getByTestId('rsi-matrix-Baseline').querySelector('td[data-ok="fail"]')?.getAttribute('title')).toBe('12 steps · reach_stall')
    // The plain per-seed table is gone.
    expect(screen.queryByText(en['rsi.firstDeath'])).toBeNull()
  })

  it('the round card summary reads the series row of the shown round; the heat strip rides the same rows', async () => {
    const rows = campaign.rounds.map(({ round, before, after, best }) => ({
      round, before, after, best, node_rate: { before: 0.25, after: 0.5, best: 0.5 },
      by_task: { grasp: { before: 0, after: round === 1 ? 1 : 0.5 } },
    }))
    mount(props({ fetchRsiSeries: vi.fn(() => Promise.resolve(ok(rows))) }))
    await waitFor(() => { expect(screen.getByTestId('rsi-round-summary')).toBeTruthy() })
    // Round 2 (latest) is shown: no nodes on its per_seed, so node_rate percentages; grasp half-passed.
    expect(screen.getByTestId('rsi-round-summary').textContent).toBe('Nodes passed 25% → 50% · Subtasks grasp 50%')
    expect(screen.getByTestId('rsi-heat').querySelectorAll('td[data-task="grasp"]')).toHaveLength(2)
    fireEvent.click(roundChips()[0] as Element)
    expect(screen.getByTestId('rsi-round-summary').textContent).toBe('Nodes passed 25% → 50% · Subtasks grasp ✓')
  })

  it('round card: an LLM 分析 beat with the summary above 看到了什么, the proposer chip and rationale under 试了什么, the chip on the round chips', async () => {
    mount(props())
    await waitFor(() => { expect(roundChips()).toHaveLength(2) })
    // Round 2 (latest) came from the rules: no analysis beat, a 规则 chip, no rationale.
    expect(screen.queryByTestId('rsi-analysis')).toBeNull()
    expect(screen.queryByTestId('rsi-rationale')).toBeNull()
    const triedBeat = () => screen.getByText(en['rsi.tried']).parentElement as HTMLElement
    expect(triedBeat().querySelector('[data-proposer]')?.getAttribute('data-proposer')).toBe('rules')
    fireEvent.click(roundChips()[0] as HTMLElement)
    expect(screen.getByTestId('rsi-analysis').textContent).toBe(`${en['rsi.analysis']}grasp-0 stalls on seed 2`)
    expect(screen.getByTestId('rsi-analysis').nextElementSibling?.textContent).toMatch(new RegExp(`^${en['rsi.saw']}`))
    expect(screen.getByTestId('rsi-rationale').textContent).toBe('pi05 handles reach better')
    expect(screen.getByTestId('rsi-rationale').parentElement?.textContent).toContain('LLM grasp-0: switch executor to pi05')
    // The tree's nodes carry the same source word, in round order.
    expect(roundChips().map(c => c.getAttribute('data-proposer'))).toEqual(['llm', 'rules'])
  })

  it('hypothesis tree: lanes by parent, green ring on published, grey on same / worse / none, edges parent → child, a node picks the round', async () => {
    const rounds = [
      { round: 1, parent: 0, outcome: 'improved', published: true, before: 1, after: 2, best: 2, tried: { kind: 'executor', node: 'grasp-0', detail: { to: 'pi05' } } },
      { round: 2, parent: 1, outcome: 'same', published: false, before: 2, after: 2, best: 2, tried: { kind: 'card', node: 'grasp-0', detail: { to: 'c1' } } },
      { round: 3, parent: 1, outcome: 'worse', published: false, before: 2, after: 1, best: 2, tried: { kind: 'card', node: 'grasp-0', detail: { to: 'c2' } } },
      { round: 4, parent: 1, outcome: 'improved', published: true, before: 2, after: 3, best: 3, tried: { kind: 'card', node: 'grasp-0', detail: { to: 'c3' } } },
      { round: 5, parent: 4, outcome: 'none', published: false, before: 3, after: 3, best: 3, tried: { kind: 'none', detail: { reason: 'r' } } },
    ]
    const p = props({ fetchRsiRun: vi.fn(() => Promise.resolve(ok({ ...campaign, rounds, latest: rounds[4] }))) })
    const { container } = mount(p)
    await waitFor(() => { expect(roundChips()).toHaveLength(5) })
    const nodes = roundChips()
    expect(nodes.map(n => n.getAttribute('data-lane'))).toEqual(['0', '1', '1', '1', '2'])
    expect(nodes.map(n => n.getAttribute('data-published'))).toEqual(['true', null, null, 'true', null])
    expect(nodes.map(n => n.getAttribute('data-outcome'))).toEqual(['improved', 'same', 'worse', 'improved', 'none'])
    expect([...container.querySelectorAll('[data-edge]')].map(e => e.getAttribute('data-edge'))).toEqual(['1-2', '1-3', '1-4', '4-5'])
    expect(nodes[4]?.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(nodes[2] as HTMLElement)
    expect(nodes[2]?.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('2 → 1 (best 2)')).toBeTruthy()
    // Legacy rows without parent all share lane 0.
    expect(treeLayout([{ round: 2 }, { round: 1 }]).map(n => [n.round, n.x, n.lane])).toEqual([[1, 0, 0], [2, 1, 0]])
  })

  it('status card: while the phase is propose the 试 step reads LLM 分析中 with the message line', async () => {
    const live = { phase: 'propose', round: 3, seeds_total: 3, seed_index: 3, seed: null, node: null, started_at: Date.now() / 1000 - 40, message: 'LLM 分析第 3 轮…' }
    const { container } = mount(props({ fetchRsiRun: vi.fn(() => Promise.resolve(ok({ ...campaign, live }))) }))
    await waitFor(() => { expect(container.querySelector('[aria-current="step"]')).toBeTruthy() })
    const step = container.querySelector('[aria-current="step"]') as HTMLElement
    expect(step.getAttribute('data-phase')).toBe('propose')
    expect(step.textContent).toBe(en['rsi.phase.proposing'])
    expect(screen.getByText('LLM 分析第 3 轮…')).toBeTruthy()
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
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledWith('{"kind":"evolve","task":"new_task","proposer":"llm"}', 'session-main') })
    // Resume = pick the campaign chip (prefills its task) and press the same button; the 提议器 select rides the brief.
    fireEvent.change(screen.getByLabelText(en['rsi.proposer']), { target: { value: 'rules' } })
    fireEvent.click(chip('pack_lunch'))
    expect(input.value).toBe('pack_lunch')
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: en['evolve.start'] }))
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledWith('{"kind":"evolve","task":"pack_lunch","proposer":"rules"}', 'session-main') })
    expect(p.cancelBrief).not.toHaveBeenCalled()
  })

  it('start answers at once: submitted with the brief id and a ticking counter, then claimed once the campaign runs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let rows: Array<Record<string, unknown>> = campaigns.map(c => ({ ...c, status: 'done', open_brief: null }))
      const p = props({
        fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok(rows))),
        submitBrief: vi.fn(() => Promise.resolve(ok({ submitted: 'brief-42', inbox: 'x' }))),
      })
      mount(p)
      await waitFor(() => { expect(chip('kitchen_thaw').getAttribute('aria-pressed')).toBe('true') })
      const start = () => screen.getByRole('button', { name: en['evolve.start'] }) as HTMLButtonElement
      const stop = () => screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement
      expect(stop().disabled).toBe(true)
      fireEvent.click(start())
      await waitFor(() => { expect(screen.getByTestId('rsi-pending').textContent).toBe('Submitted brief-42 · waiting for the runtime to claim it · 0s') })
      // Start is held for this task while its brief waits; Stop can already cancel that brief.
      expect(start().disabled).toBe(true)
      expect(stop().disabled).toBe(false)
      await vi.advanceTimersByTimeAsync(1000)
      expect(screen.getByTestId('rsi-pending').textContent).toMatch(/· 1s$/)
      // The 2s poll sees the campaign running: 认领, the status card takes over, Start is free again.
      rows = rows.map(c => (c.task === 'kitchen_thaw' ? { ...c, status: 'running', open_brief: 'brief-42' } : c))
      await vi.advanceTimersByTimeAsync(2000)
      await waitFor(() => { expect(screen.getByTestId('rsi-pending').textContent).toBe('brief-42 claimed') })
      expect(screen.getByTestId('rsi-status')).toBeTruthy()
      expect(start().disabled).toBe(false)
      await vi.advanceTimersByTimeAsync(4000)
      expect(screen.queryByTestId('rsi-pending')).toBeNull()
      // Stop cancels the pending brief itself when nothing claimed it yet.
      rows = rows.map(c => ({ ...c, status: 'done', open_brief: null }))
      fireEvent.change(screen.getByPlaceholderText(en['evolve.taskHint']), { target: { value: 'pack_lunch' } })
      fireEvent.click(start())
      await waitFor(() => { expect(stop().disabled).toBe(false) })
      fireEvent.click(stop())
      await waitFor(() => { expect(p.cancelBrief).toHaveBeenCalledWith('brief-42', 'session-main') })
      await waitFor(() => { expect(screen.queryByTestId('rsi-pending')).toBeNull() })
    } finally {
      vi.useRealTimers()
    }
  })

  it('start: says so after 60s unclaimed, and shows the error when the submit fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const p = props({
        fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok(campaigns.map(c => ({ ...c, status: 'done', open_brief: null }))))),
        submitBrief: vi.fn()
          .mockResolvedValueOnce(ok({ submitted: 'brief-1', inbox: 'x' }))
          .mockResolvedValueOnce(ok({ error: 'inbox missing' }))
          .mockRejectedValueOnce(new Error('down')),
      })
      mount(p)
      await waitFor(() => { expect(chip('kitchen_thaw').getAttribute('aria-pressed')).toBe('true') })
      const start = () => screen.getByRole('button', { name: en['evolve.start'] })
      fireEvent.click(start())
      await waitFor(() => { expect(screen.getByTestId('rsi-pending').textContent).toMatch(/^Submitted brief-1 · waiting/) })
      await vi.advanceTimersByTimeAsync(60000)
      expect(screen.getByTestId('rsi-pending').textContent).toBe('Submitted brief-1 · not claimed within 60 s: check the runtime is online (health panel) · 60s')
      // Another task can still start; its submit fails with the board's words, then with the transport's.
      fireEvent.change(screen.getByPlaceholderText(en['evolve.taskHint']), { target: { value: 'pack_lunch' } })
      fireEvent.click(start())
      await waitFor(() => { expect(screen.getByText('inbox missing')).toBeTruthy() })
      fireEvent.click(start())
      await waitFor(() => { expect(screen.getByText(en['brain.transportFail'])).toBeTruthy() })
    } finally {
      vi.useRealTimers()
    }
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

describe('usageLine / confirmLine', () => {
  it('sums prompt + completion into k, — with no LLM; the confirm verdict is the publish decision', () => {
    expect(usageLine({ llm_tokens: { prompt: 1000, completion: 234 }, sim_s: 163.6 }, t as never)).toBe('LLM tokens 1.2k · sim 164 s')
    expect(usageLine({ llm_tokens: { prompt: 900 }, sim_s: 5 }, t as never)).toBe('LLM tokens 900 · sim 5 s')
    expect(usageLine({ llm_tokens: null, sim_s: null }, t as never)).toBe('LLM tokens — · sim 0 s')
    expect(confirmLine({ confirm: { seeds: [4247, 4248], before: 0, after: 1 }, published: true }, t as never)).toBe('Confirm seeds 4247,4248 · 0/2 → 1/2 · passed')
    expect(confirmLine({ confirm: { seeds: [4247, 4248], before: 1, after: 1 }, published: false }, t as never)).toBe('Confirm seeds 4247,4248 · 1/2 → 1/2 · failed')
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

  it('prints tunable numbers to at most 4 significant digits', () => {
    const tt = t as unknown as Parameters<typeof describeTried>[1]
    expect(describeTried({ kind: 'tunables', node: 'grasp-0', detail: { path: ['reach_tol'], from: 0.05, to: 0.034999999999999996 } }, tt)).toBe('grasp-0: reach_tol 0.05 → 0.035')
    expect(describeTried({ kind: 'tunables', node: 'grasp-0', detail: { path: 'max_steps', from: 120, to: 144 } }, tt)).toBe('grasp-0: max_steps 120 → 144')
    expect(fmtNum(1234567)).toBe('1235000')
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

describe('SeriesChart / TaskHeat / roundSummary (node_rate + by_task rows)', () => {
  const series = [
    { round: 1, before: 0, after: 1, best: 1, node_rate: { before: 0.25, after: 0.5, best: 0.5 },
      by_task: { nav: { before: 0.5, after: 1 }, grasp: { before: 0, after: 0.5 }, drop: { before: 0, after: 0 } } },
    { round: 2, before: 1, after: 1, best: 1, node_rate: { before: 0.5, after: 0.5, best: 0.5 },
      by_task: { nav: { before: 1, after: 1 }, grasp: { before: 0.5, after: 0 }, drop: { before: 0, after: null } } },
  ]

  it('draws node_rate·100 solid and after k/n·100 dotted on one percentage axis; a toggle hides either group', () => {
    const { container } = render(<SeriesChart series={series} n={2} t={t as never} />)
    // y = 104 - pct/100·96: 25% → 80, 50% → 56 (node lines); task after 1/2 → 50% on both rounds.
    expect(container.querySelector('polyline[data-series="before"]')?.getAttribute('points')).toBe('26,80 312,56')
    expect(container.querySelector('polyline[data-series="task"]')?.getAttribute('points')).toBe('26,56 312,56')
    expect(container.querySelector('polyline[data-series="task"]')?.getAttribute('class')).toMatch(/chartTask/)
    fireEvent.click(container.querySelector('input[data-group="nodes"]') as Element)
    expect(container.querySelectorAll('polyline')).toHaveLength(1)
    fireEvent.click(container.querySelector('input[data-group="task"]') as Element)
    expect(container.querySelectorAll('polyline')).toHaveLength(0)
    expect(screen.getByText(en['rsi.chart.nodes'])).toBeTruthy()
    expect(screen.getByText(en['rsi.chart.task'])).toBeTruthy()
  })

  it('heat strip: tasks in first-seen order × rounds, after (else before) coloured, k/n tooltip, ▲ / ▼ off before', () => {
    const { container } = render(<TaskHeat series={series} n={2} t={t as never} />)
    expect((screen.getByTestId('rsi-heat') as HTMLDetailsElement).open).toBe(true)
    expect([...container.querySelectorAll('tbody th')].map(e => e.textContent)).toEqual(['nav', 'grasp', 'drop'])
    const cell = (task: string, r: number) => container.querySelector(`td[data-task="${task}"][data-round="${r}"]`) as HTMLElement
    expect(cell('nav', 1).title).toBe('Round 1 · nav passed 2/2')
    expect(cell('nav', 1).textContent).toBe('▲')
    expect(cell('nav', 2).textContent).toBe('')
    expect(cell('grasp', 2).textContent).toBe('▼')
    expect(cell('grasp', 2).title).toBe('Round 2 · grasp passed 0/2')
    expect(cell('grasp', 1).getAttribute('data-rate')).toBe('0.5')
    expect(cell('grasp', 1).style.background).toContain('color-mix')
    // after null falls back to before; no arrow.
    expect(cell('drop', 2).getAttribute('data-rate')).toBe('0')
    expect(cell('drop', 2).textContent).toBe('')
    expect(render(<TaskHeat series={[{ round: 1, before: 0, after: 0, best: 0 }]} n={2} t={t as never} />).container.textContent).toBe('')
  })

  it('roundSummary: node counts off per_seed / after_seeds nodes, subtask verdicts off by_task', () => {
    const nodes = (oks: boolean[]) => oks.map((ok, i) => ({ id: `n${i}`, ok }))
    const r = {
      round: 1, per_seed: [{ seed: 1, nodes: nodes([true, false, false, false]) }, { seed: 2, nodes: nodes([true, true, true, false]) }],
      after_seeds: [{ seed: 1, nodes: nodes([true, true, true, false]) }, { seed: 2, nodes: nodes([true, true, true, false]) }],
    }
    const rates = { by_task: {
      nav: { before: 1, after: 1 }, grasp: { before: 0.5, after: 1 }, carry: { before: 0, after: 1 }, drop: { before: 0, after: 0 },
    } }
    expect(roundSummary(r, rates, t as never)).toBe('Nodes passed 4/8 → 6/8 · Subtasks nav ✓ grasp ✓ carry ✓ drop ✗')
    // Nothing retested: after repeats before; a half-passed task shows its percentage.
    expect(roundSummary({ ...r, after_seeds: [] }, { by_task: { grasp: { before: 0.5, after: null } } }, t as never)).toBe('Nodes passed 4/8 → 4/8 · Subtasks grasp 50%')
    // Rows without nodes fall back to the series row's node_rate as percentages; neither → ''.
    expect(roundSummary({ round: 2 }, { node_rate: { before: 0.25, after: 0.5, best: 0.5 } }, t as never)).toBe('Nodes passed 25% → 50%')
    expect(roundSummary({ round: 3 }, undefined, t as never)).toBe('')
  })
})
