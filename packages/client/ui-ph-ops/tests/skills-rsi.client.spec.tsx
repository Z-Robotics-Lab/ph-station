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

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { RsiView, TaskHeat, confirmLine, describeEvent, describeTried, fmtNum, roundSummary, usageLine } from '../src/client/RsiView.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const ok = (value: unknown): RemoteResult<unknown> => ({ ok: true, value })
const t = (key: keyof typeof en, params?: Record<string, unknown>) =>
  en[key].replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k]))
const sessions = ok([{ name: 'session-main', kinds: { 'runtime.boot': 1 } }])
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

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
      fetchRsiModelOptions: vi.fn(() => Promise.resolve(ok({ default_model: 'discovered-default', default_effort: 'off', models: [{ id: 'discovered-default' }, { id: 'choice-model' }], efforts: ['off', 'low', 'high', 'max'] }))),
      fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok(campaigns))),
      // The real face is BOUNDED: no round -> header + the compact tail; round=n
      // -> that ONE round in full, as a single-element `rounds`.
      fetchRsiRun: vi.fn((_s: string, task: string, round?: number) => Promise.resolve(ok(
        task !== 'kitchen_thaw'
          ? null
          : round ? { ...campaign, rounds: campaign.rounds.filter(r => r.round === round) } : campaign))),
      // The compact row the real face returns: scalars off the round, no trails.
      fetchRsiSeries: vi.fn(() => Promise.resolve(ok(
        campaign.rounds.map(({ round, before, after, best, parent, proposer, outcome, published, usage, tried }) =>
          ({ round, before, after, best, parent, proposer, outcome, published, usage, tried })),
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
  const roundChips = () => {
    return Array.from(screen.getByTestId('rsi-rounds').querySelectorAll<HTMLButtonElement>('button[data-round]'))
      .sort((a, b) => Number(a.dataset.round) - Number(b.dataset.round))
  }
  const log = () => screen.getByTestId('rsi-log') as HTMLDetailsElement

  it('shows provider defaults and omits unchosen model fields from the next brief', async () => {
    const p = props({ fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok([]))) })
    mount(p)
    await screen.findByText(en['rsi.guide'])
    fireEvent.click(screen.getByRole('tab', { name: en['rsi.tab.models'] }))
    expect(screen.getByTestId('rsi-model-draft').textContent).toContain('Backend default (discovered-default)')
    expect(screen.getByTestId('rsi-model-draft').textContent).toContain('Backend default (off)')
    expect(screen.getByTestId('rsi-model-recorded').textContent).toContain(en['rsi.models.unrecorded'])
    expect([...screen.getByRole('combobox', { name: en['rsi.models.effort'] }).querySelectorAll('option')].map(o => o.value)).toEqual(['', 'off', 'low', 'high', 'max'])
    expect(p.submitBrief).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('tab', { name: en['rsi.tab.models'] }), { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: en['rsi.tab.run'] }).getAttribute('aria-selected')).toBe('true')
    fireEvent.change(screen.getByPlaceholderText(en['evolve.taskHint']), { target: { value: 'new_task' } })
    fireEvent.click(screen.getByRole('button', { name: en['evolve.start'] }))
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledOnce() })
    expect(JSON.parse((p.submitBrief.mock.calls[0] as unknown as [string, string])[0])).toEqual({ kind: 'evolve', task: 'new_task', proposer: 'llm', continuous: true, rounds: 0 })
  })

  it('keeps model drafts across tabs and submits explicit choices only on resume', async () => {
    const p = props({
      fetchRsiRun: vi.fn(() => Promise.resolve(ok({ ...campaign, llm_config: { model: 'recorded-model', effort: 'low' } }))),
    })
    const { container } = mount(p)
    await screen.findByTestId('rsi-dashboard')
    fireEvent.click(screen.getByRole('tab', { name: en['rsi.tab.models'] }))
    expect([...container.querySelectorAll('#ph-rsi-models option')].map(o => o.getAttribute('value'))).toEqual(['discovered-default', 'choice-model'])
    fireEvent.change(screen.getByRole('combobox', { name: en['rsi.models.model'] }), { target: { value: ' custom/model ' } })
    fireEvent.change(screen.getByRole('combobox', { name: en['rsi.models.effort'] }), { target: { value: 'high' } })
    expect(screen.getByTestId('rsi-model-recorded').textContent).toContain('Model: recorded-model · effort: low')
    expect(p.submitBrief).not.toHaveBeenCalled()
    expect(p.cancelBrief).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('tab', { name: en['rsi.tab.run'] }))
    expect(screen.getByRole<HTMLButtonElement>('button', { name: en['evolve.start'] }).disabled).toBe(true)
    fireEvent.click(chip('pack_lunch'))
    fireEvent.click(screen.getByRole('tab', { name: en['rsi.tab.models'] }))
    expect(screen.getByRole<HTMLInputElement>('combobox', { name: en['rsi.models.model'] }).value).toBe(' custom/model ')
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: en['rsi.models.effort'] }).value).toBe('high')
    fireEvent.click(screen.getByRole('tab', { name: en['rsi.tab.run'] }))
    fireEvent.click(screen.getByRole('button', { name: en['evolve.start'] }))
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledOnce() })
    expect(JSON.parse((p.submitBrief.mock.calls[0] as unknown as [string, string])[0])).toMatchObject({ task: 'pack_lunch', llm_model: 'custom/model', llm_effort: 'high' })
  })

  it('keeps typed selections when discovery resolves late or refreshes', async () => {
    const late = deferred<RemoteResult<unknown>>()
    const p = props({ fetchRsiModelOptions: vi.fn(() => late.promise) })
    mount(p)
    await screen.findByTestId('rsi-dashboard')
    fireEvent.click(screen.getByRole('tab', { name: en['rsi.tab.models'] }))
    fireEvent.change(screen.getByRole('combobox', { name: en['rsi.models.model'] }), { target: { value: 'typed-before-discovery' } })
    await act(async () => { late.resolve(ok({ default_model: 'new-default', default_effort: 'off', models: [{ id: 'new-default' }], efforts: ['off', 'max'] })) })
    fireEvent.change(screen.getByRole('combobox', { name: en['rsi.models.effort'] }), { target: { value: 'max' } })
    fireEvent.click(screen.getByRole('button', { name: en['rsi.models.refresh'] }))
    await waitFor(() => { expect(p.fetchRsiModelOptions).toHaveBeenCalledTimes(2) })
    expect(screen.getByRole<HTMLInputElement>('combobox', { name: en['rsi.models.model'] }).value).toBe('typed-before-discovery')
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: en['rsi.models.effort'] }).value).toBe('max')
    expect(p.submitBrief).not.toHaveBeenCalled()
  })

  it.each(['discovery', 'transport'])('shows %s failures and permits an explicit model with default effort', async (failure) => {
    const p = props({
      fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok([]))),
      fetchRsiModelOptions: vi.fn(() => Promise.resolve(failure === 'discovery'
        ? ok({ default_model: null, default_effort: 'off', models: [], efforts: ['off', 'low'], error: 'provider unavailable' })
        : { ok: false, error: { code: 'internal', message: 'provider unavailable', details: {} } })),
    })
    mount(p)
    await screen.findByText(en['rsi.guide'])
    fireEvent.click(screen.getByRole('tab', { name: en['rsi.tab.models'] }))
    expect(screen.getByRole('alert').textContent).toContain('provider unavailable')
    fireEvent.change(screen.getByRole('combobox', { name: en['rsi.models.model'] }), { target: { value: 'manual/model' } })
    fireEvent.click(screen.getByRole('tab', { name: en['rsi.tab.run'] }))
    fireEvent.change(screen.getByPlaceholderText(en['evolve.taskHint']), { target: { value: 'new_task' } })
    fireEvent.click(screen.getByRole('button', { name: en['evolve.start'] }))
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledOnce() })
    const brief = JSON.parse((p.submitBrief.mock.calls[0] as unknown as [string, string])[0]) as { llm_model?: string; llm_effort?: string }
    expect(brief.llm_model).toBe('manual/model')
    expect(brief).not.toHaveProperty('llm_effort')
  })

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
    await waitFor(() => { expect(roundChips()).toHaveLength(2) })
    expect(p.fetchRsiRun).toHaveBeenCalledWith('session-main', 'kitchen_thaw')
    expect(p.fetchRsiRun).not.toHaveBeenCalledWith('session-main', 'pack_lunch')
    expect(p.fetchRsiSeries).toHaveBeenCalledWith('session-main', 'kitchen_thaw')
    // Historical scalar/node diagnostics do not become comparable learning measurements.
    expect(container.querySelectorAll('[data-point]')).toHaveLength(0)
    expect([...container.querySelectorAll('text[data-axis="x"]')].map(e => e.textContent)).toEqual(['1', '2'])
    // No by_task on these rows: no heat strip; the round card carries no summary line either.
    expect(screen.queryByTestId('rsi-heat')).toBeNull()
    expect(screen.queryByTestId('rsi-round-summary')).toBeNull()
    // Status card: this running campaign predates live progress — it says so and nothing more (the chip has the rest).
    const status = screen.getByTestId('rsi-status')
    expect(status.textContent).toBe(en['rsi.noLive'])
    expect(container.querySelector('[aria-current="step"]')).toBeNull()
    // The recent round table stays visible; detail evidence remains folded separately.
    expect(screen.getByText('2 → 2 (best 2)').closest('details')).toBeNull()
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
    expect(within(screen.getByTestId('rsi-media-gallery')).getByRole('button', {
      name: 'media/kitchen_thaw/1/grasp-0.mp4',
    }).getAttribute('aria-pressed')).toBe('true')
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
    expect(screen.getByTestId('rsi-confirm').textContent).toBe(`${en['rsi.confirm']}Confirm seeds 4247,4248 · 0/2 → 1/2 · historically published`)
    expect(screen.getByTestId('rsi-usage').textContent).toBe('LLM tokens 1.2k · sim 164 s')
    // Stop cancels the campaign's open_brief.
    fireEvent.click(screen.getByRole('button', { name: en['evolve.stop'] }))
    await waitFor(() => { expect(p.cancelBrief).toHaveBeenCalledWith('b-evolve', 'session-main') })
  })

  it('keeps every clip reachable through one main media player', async () => {
    const paths = ['reach.mp4', 'grasp.mp4', 'carry.mp4', 'drop.mp4', 'final.png', 'detail.jpg']
      .map(name => `media/kitchen_thaw/2/${name}`)
    const p = props({ fetchRsiFrames: vi.fn(() => Promise.resolve(ok({ media: paths, dropped: {} }))) })
    mount(p)
    const gallery = await screen.findByTestId('rsi-media-gallery')
    expect(within(gallery).getAllByRole('button')).toHaveLength(paths.length)
    for (const path of paths) {
      const button = within(gallery).getByRole('button', { name: path })
      fireEvent.click(button)
      const media = gallery.querySelectorAll('video, img')
      expect(media).toHaveLength(1)
      expect(media[0]?.getAttribute('src')).toBe(`/api/board/media/session-main/${path}`)
      expect(media[0]?.tagName).toBe(path.endsWith('.mp4') ? 'VIDEO' : 'IMG')
      expect(button.getAttribute('aria-pressed')).toBe('true')
      expect(within(gallery).getAllByRole('button').filter(b => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
    }
  })

  it('clears the selected clip while another round loads and selects that round’s own media', async () => {
    const firstRound = deferred<RemoteResult<unknown>>()
    const paths = ['media/kitchen_thaw/2/reach.mp4', 'media/kitchen_thaw/2/drop.mp4'] as const
    const fetchRsiFrames = vi.fn((_s: string, _t: string, round: number) => round === 1
      ? firstRound.promise
      : Promise.resolve(ok({ media: paths, dropped: {} })))
    mount(props({ fetchRsiFrames }))
    const gallery = await screen.findByTestId('rsi-media-gallery')
    fireEvent.click(within(gallery).getByRole('button', { name: paths[1] }))
    expect(gallery.querySelector('video')?.getAttribute('src')).toContain(paths[1])
    fireEvent.click(roundChips()[0] as HTMLElement)
    await waitFor(() => { expect(fetchRsiFrames).toHaveBeenCalledWith('session-main', 'kitchen_thaw', 1) })
    expect(screen.queryByTestId('rsi-media-gallery')).toBeNull()
    const nextPath = 'media/kitchen_thaw/1/reach.mp4'
    await act(async () => { firstRound.resolve(ok({ media: [nextPath], dropped: {} })) })
    const nextGallery = await screen.findByTestId('rsi-media-gallery')
    expect(nextGallery.querySelectorAll('video, img')).toHaveLength(1)
    expect(nextGallery.querySelector('video')?.getAttribute('src')).toBe(`/api/board/media/session-main/${nextPath}`)
    expect(within(nextGallery).getByRole('button', { name: nextPath }).getAttribute('aria-pressed')).toBe('true')
    for (const path of paths) expect(within(nextGallery).queryByRole('button', { name: path })).toBeNull()
  })

  it('keeps round media and logs beside development evidence and uses accepted trial ancestry', async () => {
    const evaluation = {
      protocol_id: 'fixed-obligations-v1', objective_id: 'kitchen_thaw',
      before: { successes: 0, episodes: 2, progress: 0.25, obligations: 4 },
      after: { successes: 0, episodes: 2, progress: 0.5, obligations: 4 },
      acceptance: { accepted: true, reason: 'fixed objective improved' },
      installation: { status: 'not_evaluated', reason: 'battery not run' },
    }
    const rows = campaign.rounds.map(r => ({ ...r, published: false, accepted: true, evaluation }))
    const p = props({
      fetchRsiRun: vi.fn((_s: string, _task: string, round?: number) => Promise.resolve(ok({
        ...campaign, rounds: round ? rows.filter(r => r.round === round) : rows,
      }))),
      fetchRsiSeries: vi.fn(() => Promise.resolve(ok(rows))),
    })
    const { container } = mount(p)
    await waitFor(() => { expect(screen.getByTestId('rsi-acceptance').textContent).toContain('Accepted') })
    expect(screen.getByTestId('rsi-installation').textContent).toContain('Installation not evaluated')
    expect(screen.queryByText(en['rsi.published'])).toBeNull()
    expect(container.querySelectorAll('[data-accepted="true"]')).toHaveLength(2)
    fireEvent.click(roundChips()[0]!)
    await waitFor(() => { expect(container.querySelector('video')).toBeTruthy() })
    expect(screen.getByText(en['rsi.saw'])).toBeTruthy()
    expect(screen.getByTestId('rsi-log')).toBeTruthy()
  })

  it('keeps media and analysis in separate dashboard panels with operational logs outside', async () => {
    const p = props()
    mount(p)
    await waitFor(() => { expect(chip('kitchen_thaw')).toBeTruthy() })
    fireEvent.click(roundChips()[0]!)
    await waitFor(() => { expect(screen.getByTestId('rsi-live-panel').querySelector('video')).toBeTruthy() })
    const dashboard = screen.getByTestId('rsi-dashboard')
    const media = within(dashboard).getByTestId('rsi-live-panel')
    const analysis = within(dashboard).getByTestId('rsi-analysis-panel')
    expect(media.querySelector('video')?.getAttribute('src')).toContain('grasp-0.mp4')
    expect(media.querySelector('[data-testid="rsi-dropped"] img')).toBeTruthy()
    expect(analysis.querySelector('[data-testid="rsi-rounds"]')).toBeTruthy()
    expect(analysis.textContent).toContain('grasp-0 stalls on seed 2')
    expect(analysis.textContent).toContain('1.2k')
    expect(dashboard.contains(screen.getByTestId('rsi-log'))).toBe(false)
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
    expect(runningNode.textContent).toBe('Round 3 · running')
    // The live frame polls runtimeFrame and lands in the <img>.
    await waitFor(() => { expect(p.fetchRuntimeFrame).toHaveBeenCalledWith('session-main', 0) })
    await waitFor(() => { expect((container.querySelector('img') as HTMLImageElement).src).toBe('data:image/jpeg;base64,AAAA') })
  })

  it('keeps additional development-seed confirmation live without showing the original seed range', async () => {
    const live = {
      phase: 'confirm', round: 3, seeds_total: 2, seed_index: 1, seed: 4248,
      node: 'grasp-0', round_started_at: Date.now() / 1000 - 10,
      per_seed_partial: [{ seed: 4247, success: false, first_death: 'grasp-0' }],
      message: 'additional development pass',
    }
    const p = props({ fetchRsiRun: vi.fn(() => Promise.resolve(ok({ ...campaign, live }))) })
    const { container } = mount(p)
    await waitFor(() => { expect(container.querySelector('[aria-current="step"]')?.getAttribute('data-phase')).toBe('confirm') })
    expect(container.querySelector('[aria-current="step"]')?.textContent).toBe('Additional development seeds')
    expect(screen.queryByText(en['rsi.noLive'])).toBeNull()
    expect(screen.getByTestId('rsi-seed-board').textContent).toBe('4247 ✗ died at grasp-04248 running')
    expect(screen.getByTestId('rsi-status').textContent).not.toMatch(/held.?out/i)
    await waitFor(() => { expect(p.fetchRuntimeFrame).toHaveBeenCalled() })
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
    const evidence = screen.getByTestId('rsi-seed-evidence') as HTMLDetailsElement
    expect(evidence.open).toBe(false)
    expect(evidence.querySelector('summary')?.textContent).toBe(en['rsi.saw'])
    expect(evidence.querySelectorAll('table')).toHaveLength(2)
    fireEvent.click(evidence.querySelector('summary') as HTMLElement)
    expect(evidence.open).toBe(true)
    expect(within(evidence).getAllByRole('table')).toHaveLength(2)
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
    expect(triedBeat().textContent).toContain('Historical rules')
    fireEvent.click(roundChips()[0] as HTMLElement)
    expect(screen.getByTestId('rsi-analysis').textContent).toBe(`${en['rsi.analysis']}grasp-0 stalls on seed 2`)
    expect(screen.getByTestId('rsi-analysis').nextElementSibling?.textContent).toMatch(new RegExp(`^${en['rsi.saw']}`))
    expect(screen.getByTestId('rsi-rationale').textContent).toBe('pi05 handles reach better')
    expect(screen.getByTestId('rsi-rationale').parentElement?.textContent).toContain('LLM grasp-0: switch executor to pi05')
    // The tree's nodes carry the same source word, in round order.
    expect(roundChips().map(c => c.getAttribute('data-proposer'))).toEqual(['llm', 'rules'])
  })

  it.each([
    ['proposed', 'Candidate proposed', 'executor', undefined],
    ['abstained', 'Model abstained', 'none', 'model_stop'],
    ['abstained', 'No candidate proposed this round', 'none', 'repeated_invalid_command'],
    ['abstained', 'No candidate proposed this round', 'none', 'future_guard'],
    ['abstained', 'No candidate proposed this round', 'none', undefined],
    ['rejected', 'Candidate validation budget exhausted', 'none', undefined],
  ])('renders model status %s without treating none as a provider failure (%s)', async (status, label, kind, stop_reason) => {
    const r = { round: 3, proposer: 'llm', outcome: kind === 'none' ? 'none' : 'same',
      tried: { kind, detail: { reason: 'recorded reason' } },
      llm: { status, stop_reason, summary: '', reason: 'recorded reason', model: 'deepseek-chat', prompt_sha: 'prompt-3', attempts: [{ attempt: 1, validation: 'observed' }] } }
    const settled = { ...campaign, status: 'done', latest: r, rounds: [r] }
    mount(props({
      fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok([{ ...campaigns[0], status: 'done', open_brief: null }]))),
      fetchRsiRun: vi.fn(() => Promise.resolve(ok(settled))),
    }))
    await waitFor(() => { expect(screen.getByTestId('rsi-llm-status').textContent).toBe(label) })
    expect(screen.queryByTestId('rsi-failure')).toBeNull()
    expect(screen.queryByTestId('rsi-llm-error')).toBeNull()
    expect(screen.queryByTestId('rsi-analysis')).toBeNull()
    if (stop_reason !== undefined) expect(screen.getByTestId('rsi-llm-stop').textContent).toBe(`Stop reason ${stop_reason}`)
    const audit = screen.getByTestId('rsi-llm-audit')
    expect(audit.textContent).toContain('Model deepseek-chat · Prompt digest prompt-3')
    expect(JSON.parse(audit.querySelector('pre')?.textContent ?? '{}').attempts).toEqual([{ attempt: 1, validation: 'observed' }])
  })

  it('renders sealed model-call failure with its stage and error; it never looks like a normal none result', async () => {
    const r = { round: 3, proposer: 'llm', outcome: 'error', tried: { kind: 'none', detail: { reason: 'model_endpoint' } },
      needs: ['model_endpoint'], llm: { status: 'error', reason: 'provider unavailable', model: 'deepseek-chat', prompt_sha: 'prompt-3',
        error: { type: 'HTTPError', message: '402 Payment Required', stage: 'request' } } }
    const settled = { ...campaign, status: 'failed', latest: r, rounds: [r], live: { phase: 'failed', message: 'model_endpoint failed' } }
    const p = props({
      fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok([{ ...campaigns[0], status: 'failed', open_brief: null }]))),
      fetchRsiRun: vi.fn(() => Promise.resolve(ok(settled))),
    })
    mount(p)
    await waitFor(() => { expect(screen.getByTestId('rsi-llm-status').textContent).toBe('Model call failed') })
    expect(screen.getByTestId('rsi-failure').textContent).toBe('Run failed · model_endpoint failed')
    expect(chip('kitchen_thaw').textContent).toContain('Run failed')
    expect(screen.getByTestId('rsi-llm-error').textContent).toBe('Stage request · HTTPError · 402 Payment Required')
    expect(log().open).toBe(true)
    expect(screen.queryByTestId('rsi-status')).toBeNull()
    expect(p.fetchRuntimeFrame).not.toHaveBeenCalled()
    expect(screen.getByTestId('rsi-llm-audit').textContent).toContain('provider unavailable')
  })

  it('shows request budgets in bytes and exploratory calls without inventing missing token usage', async () => {
    const llm = { method: 'online_program_policy_v1', status: 'abstained', calls: 3, evidence_reads: 0, evidence_refs: [], trial_calls: 2, stop_reason: 'budget_exhausted', usage_complete: false,
      budget: { limits: {
        max_calls: 8, max_request_bytes: 24000, max_input_bytes: 96000,
        max_tool_bytes: 8000, max_read_calls: 2, max_output_tokens: 4096,
      },
      used: { calls: 3, input_bytes: 85000, tool_bytes: 9000, output_tokens: null }, usage_complete: false } }
    const r = { round: 3, proposer: 'llm', tried: { kind: 'none' }, llm, usage: { llm_tokens: null }, evaluation: { before: { progress: 0.2 }, after: null },
      run_budget: { scope: 'submitted_brief', limits: { model_calls: 12, input_bytes: 192000, probe_episodes: 6, output_tokens_per_call: 4096 },
        used: { model_calls: 9, input_bytes: 180000, probe_episodes: 4, full_evaluations: 1 } } }
    mount(props({
      fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok([{ ...campaigns[0], status: 'done', open_brief: null }]))),
      fetchRsiRun: vi.fn(() => Promise.resolve(ok({ ...campaign, latest: r, rounds: [r], status: 'done' }))),
    }))
    await waitFor(() => { expect(screen.getByTestId('rsi-llm-counts').textContent).toBe('Model calls 3/8 · evidence reads 0 · exploratory trials 2') })
    expect(screen.getByTestId('rsi-llm-budget').textContent).toContain('Total request 85000/96000 B · per-request limit 24000 B · total tool results 9000 B (per-result limit 8000 B)')
    expect(screen.getByTestId('rsi-llm-budget').textContent).toContain('Total output — tokens · per-call output limit 4096 tokens')
    expect(screen.getByTestId('rsi-llm-budget').textContent).toContain('Model token usage is incomplete')
    expect(screen.getByTestId('rsi-llm-read-limit').textContent).toBe('Batched read-call limit between newly measured probes: 2; cached results and errors do not reset it')
    expect(screen.getByTestId('rsi-llm-stop').textContent).toBe('Stop reason budget_exhausted')
    expect(screen.getByTestId('rsi-llm-status').textContent).toBe('Model decision budget exhausted')
    expect(screen.queryByTestId('rsi-llm-error')).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'after · Not retested' })).toBeTruthy()
    expect(screen.getByTestId('rsi-run-budget').textContent).toBe('Cumulative budget for this submitted briefModel calls 9/12 · input 180000/192000 B · probe episodes 4/6Full candidate evaluations 1 · per-call output limit 4096 tokens')
    expect(JSON.parse(screen.getByTestId('rsi-llm-audit').querySelector('pre')?.textContent ?? '{}')).toEqual(llm)
  })

  it('keeps unknown loop counters and budgets distinct from recorded zero values', async () => {
    const r = { round: 3, llm: { method: 'online_program_policy_v1', evidence_reads: null, trial_calls: 0, budget: { used: { calls: 0, input_bytes: null } } }, run_budget: {} }
    mount(props({ fetchRsiRun: vi.fn(() => Promise.resolve(ok({ ...campaign, latest: r, rounds: [r] }))) }))
    await waitFor(() => { expect(screen.getByTestId('rsi-llm-counts').textContent).toBe('Model calls 0/— · evidence reads — · exploratory trials 0') })
    expect(screen.getByTestId('rsi-llm-budget').textContent).toContain('Total request —/— B')
    expect(screen.queryByTestId('rsi-llm-read-limit')).toBeNull()
    expect(screen.queryByTestId('rsi-llm-stop')).toBeNull()
    expect(screen.getByTestId('rsi-run-budget').textContent).toContain('Budget scope —Model calls —/— · input —/— B · probe episodes —/—')
  })

  it.each([0, null])('renders an explicit read limit of %s without filling unknown values', async (limit) => {
    const r = { round: 3, llm: { budget: { limits: { max_read_calls: limit } } } }
    mount(props({ fetchRsiRun: vi.fn(() => Promise.resolve(ok({ ...campaign, latest: r, rounds: [r] }))) }))
    await waitFor(() => { expect(screen.getByTestId('rsi-llm-budget')).toBeTruthy() })
    if (limit === null) expect(screen.queryByTestId('rsi-llm-read-limit')).toBeNull()
    else expect(screen.getByTestId('rsi-llm-read-limit').textContent).toContain('probes: 0;')
  })

  it('round table selects details and does not treat historical publication as acceptance', async () => {
    const rounds = [
      { round: 1, parent: 0, outcome: 'improved', published: true, before: 1, after: 2, best: 2, tried: { kind: 'executor', node: 'grasp-0', detail: { to: 'pi05' } } },
      { round: 2, parent: 1, outcome: 'same', published: false, before: 2, after: 2, best: 2, tried: { kind: 'card', node: 'grasp-0', detail: { to: 'c1' } } },
      { round: 3, parent: 1, outcome: 'worse', published: false, before: 2, after: 1, best: 2, tried: { kind: 'card', node: 'grasp-0', detail: { to: 'c2' } } },
      { round: 4, parent: 1, outcome: 'improved', published: true, before: 2, after: 3, best: 3, tried: { kind: 'card', node: 'grasp-0', detail: { to: 'c3' } } },
      { round: 5, parent: 4, outcome: 'none', published: false, before: 3, after: 3, best: 3, tried: { kind: 'none', detail: { reason: 'r' } } },
    ]
    // The tree rides the COMPACT series (every round), not rsi_run's 20-round tail.
    const p = props({
      fetchRsiSeries: vi.fn(() => Promise.resolve(ok(rounds))),
      fetchRsiRun: vi.fn((_s: string, _t: string, round?: number) => Promise.resolve(ok({
        ...campaign, latest: rounds[4], rounds: round ? rounds.filter(r => r.round === round) : rounds,
      }))),
    })
    const { container } = mount(p)
    await waitFor(() => { expect(roundChips()).toHaveLength(5) })
    const nodes = roundChips()
    expect(nodes.every(n => n.getAttribute('data-accepted') === null)).toBe(true)
    expect(nodes.map(n => n.getAttribute('data-outcome'))).toEqual(['improved', 'same', 'worse', 'improved', 'none'])
    expect(container.querySelector('[data-edge]')).toBeNull()
    expect(nodes[4]?.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(nodes[2] as HTMLElement)
    expect(nodes[2]?.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('2 → 1 (best 2)')).toBeTruthy()

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

  it('a failing face says WHICH call failed and why, instead of an empty chart', async () => {
    // The 490-round bug: rsi_series blew the bridge's buffer, the call died, and
    // the page just showed "no data yet" forever. It must say it out loud now.
    const p = props({
      fetchRsiSeries: vi.fn(() => Promise.resolve({ ok: false, error: { code: 'exec', message: 'stdout maxBuffer length exceeded', details: {} } } as RemoteResult<unknown>)),
    })
    mount(p)
    const line = await screen.findByTestId('rsi-face-error')
    expect(line.textContent).toBe(t('rsi.faceError', { calls: 'rsi_series: stdout maxBuffer length exceeded' }))
    // the faces that DID answer still render: the campaign chips are there
    expect(chip('kitchen_thaw')).toBeTruthy()
  })

  it('the round card asks for the selected round alone, in full', async () => {
    const p = props()
    mount(p)
    await waitFor(() => { expect(roundChips()).toHaveLength(2) })
    // the page read the campaign bounded (round 0), then round 2 (latest) in full
    expect(p.fetchRsiRun).toHaveBeenCalledWith('session-main', 'kitchen_thaw')
    await waitFor(() => { expect(p.fetchRsiRun).toHaveBeenCalledWith('session-main', 'kitchen_thaw', 2) })
    // picking round 1 fetches THAT round, never the history
    fireEvent.click(roundChips()[0] as HTMLElement)
    await waitFor(() => { expect(p.fetchRsiRun).toHaveBeenCalledWith('session-main', 'kitchen_thaw', 1) })
    // and its full detail (the trails-only beats) renders off that single round
    await waitFor(() => { expect(screen.getByTestId('rsi-analysis').textContent).toContain('grasp-0 stalls on seed 2') })
    expect(screen.getByText('1 → 2 (best 2)')).toBeTruthy()
  })

  it('loads sealed evidence and media for a round selected while still running', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let sealed = false
      const completed = { ...campaign.rounds[0], round: 3,
        llm: { summary: 'sealed exploratory feedback', calls: 3 } }
      const p = props({
        fetchRsiRun: vi.fn((_s: string, _task: string, round?: number) => Promise.resolve(ok({
          ...campaign, live: sealed ? null : { phase: 'retest', round: 3, message: 'probe running' },
          rounds: round === 3 ? (sealed ? [completed] : []) : campaign.rounds,
        }))),
        fetchRsiSeries: vi.fn(() => Promise.resolve(ok(sealed ? [...campaign.rounds, completed] : campaign.rounds))),
        fetchRsiFrames: vi.fn((_s: string, _task: string, round: number) => Promise.resolve(ok(
          sealed && round === 3 ? { media: ['media/kitchen_thaw/3/probe.mp4'], dropped: {} } : [],
        ))),
      })
      const { container } = mount(p)
      await waitFor(() => { expect(roundChips()).toHaveLength(3) })
      fireEvent.click(roundChips()[2] as HTMLElement)
      await waitFor(() => { expect(p.fetchRsiRun).toHaveBeenCalledWith('session-main', 'kitchen_thaw', 3) })
      expect(screen.queryByTestId('rsi-analysis')).toBeNull()
      sealed = true
      await act(async () => { await vi.advanceTimersByTimeAsync(2100) })
      await waitFor(() => { expect(screen.getByTestId('rsi-analysis').textContent).toContain('sealed exploratory feedback') })
      await waitFor(() => { expect(container.querySelector('video')?.getAttribute('src')).toContain('/3/probe.mp4') })
      expect(p.fetchRsiRun.mock.calls.filter(call => call[2] === 3)).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('hides the previous task during loading and ignores late full evidence and media from the same round number', async () => {
    const row = (summary: string) => ({ round: 1, before: 0, after: 0, best: 0, proposer: 'llm',
      tried: { kind: 'none', detail: { reason: summary } }, llm: { status: 'abstained', summary } })
    const run = (task: string, summary: string) => ({ ...campaign, task, status: 'done', rounds: [row(summary)], latest: row(summary) })
    const pendingCampaign = deferred<RemoteResult<unknown>>()
    const pendingFull = deferred<RemoteResult<unknown>>()
    const pendingMedia = deferred<RemoteResult<unknown>>()
    const p = props({
      fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok(campaigns.map(c => ({ ...c, status: 'done', cursor: 1, rounds: 1 }))))),
      fetchRsiRun: vi.fn((_s: string, task: string, round?: number) => task === 'pack_lunch'
        ? round === undefined ? pendingCampaign.promise : pendingFull.promise
        : Promise.resolve(ok(run(task, round === undefined ? 'kitchen compact' : 'kitchen full')))),
      fetchRsiSeries: vi.fn((_s: string, task: string) => Promise.resolve(ok([row(`${task} series`)]))),
      fetchRsiFrames: vi.fn((_s: string, task: string) => task === 'pack_lunch' ? pendingMedia.promise
        : Promise.resolve(ok(['media/kitchen_thaw/1/clip.mp4']))),
    })
    const { container } = mount(p)
    await waitFor(() => { expect(screen.getByTestId('rsi-analysis').textContent).toContain('kitchen full') })
    await waitFor(() => { expect(container.querySelector('video')?.getAttribute('src')).toContain('/kitchen_thaw/') })
    fireEvent.click(chip('pack_lunch'))
    expect(screen.getByTestId('rsi-loading')).toBeTruthy()
    expect(screen.queryByTestId('rsi-analysis')).toBeNull()
    expect(screen.queryByTestId('rsi-rounds')).toBeNull()
    expect(container.querySelector('video')).toBeNull()
    await act(async () => { pendingCampaign.resolve(ok(run('pack_lunch', 'pack compact'))) })
    await waitFor(() => { expect(p.fetchRsiRun).toHaveBeenCalledWith('session-main', 'pack_lunch', 1) })
    expect(screen.getByTestId('rsi-analysis').textContent).toContain('pack compact')
    expect(screen.getByTestId('rsi-analysis').textContent).not.toContain('kitchen full')
    expect(container.querySelector('video')).toBeNull()
    fireEvent.click(chip('kitchen_thaw'))
    await waitFor(() => { expect(screen.getByTestId('rsi-analysis').textContent).toContain('kitchen full') })
    await act(async () => {
      pendingFull.resolve(ok(run('pack_lunch', 'late pack full')))
      pendingMedia.resolve(ok(['media/pack_lunch/1/late.mp4']))
    })
    expect(screen.getByTestId('rsi-analysis').textContent).toContain('kitchen full')
    expect(container.textContent).not.toContain('late pack full')
    expect(container.querySelector('video')?.getAttribute('src')).toContain('/kitchen_thaw/')
  })

  it('rejects an old campaign response after switching away and revisiting the same task', async () => {
    const pendingFirst = deferred<RemoteResult<unknown>>()
    let kitchenReads = 0
    const run = (task: string, marker: string) => {
      const r = { round: 1, before: 0, after: 0, best: 0, proposer: 'llm',
        tried: { kind: 'none', detail: { reason: marker } }, llm: { status: 'abstained', summary: marker } }
      return { ...campaign, task, status: 'done', rounds: [r], latest: r }
    }
    const p = props({
      fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok(campaigns.map(c => ({ ...c, status: 'done', cursor: 1, rounds: 1 }))))),
      fetchRsiRun: vi.fn((_s: string, task: string, round?: number) => {
        if (round !== undefined) return Promise.resolve(ok(null))
        if (task === 'kitchen_thaw' && ++kitchenReads === 1) return pendingFirst.promise
        return Promise.resolve(ok(run(task, `${task} fresh`)))
      }),
      fetchRsiSeries: vi.fn(() => Promise.resolve(ok([]))),
      fetchRsiFrames: vi.fn(() => Promise.resolve(ok([]))),
    })
    const { container } = mount(p)
    await waitFor(() => { expect(kitchenReads).toBe(1) })
    fireEvent.click(chip('pack_lunch'))
    await waitFor(() => { expect(screen.getByTestId('rsi-analysis').textContent).toContain('pack_lunch fresh') })
    fireEvent.click(chip('kitchen_thaw'))
    await waitFor(() => { expect(screen.getByTestId('rsi-analysis').textContent).toContain('kitchen_thaw fresh') })
    await act(async () => { pendingFirst.resolve(ok(run('kitchen_thaw', 'stale initial response'))) })
    expect(screen.getByTestId('rsi-analysis').textContent).toContain('kitchen_thaw fresh')
    expect(container.textContent).not.toContain('stale initial response')
    expect(chip('kitchen_thaw').getAttribute('aria-pressed')).toBe('true')
  })

  it('the chart and heat strip render off the COMPACT series rows alone', async () => {
    // No per_seed / after_seeds / llm anywhere in these rows: the shape the
    // bounded face actually returns.
    const rows = [
      { round: 1, before: 1, after: 2, best: 2, parent: 0, proposer: 'llm', outcome: 'improved', accepted: true, published: true,
        usage: { llm_tokens: { prompt: 10, completion: 2 }, sim_s: 3 }, tried: { kind: 'executor', node: 'grasp-0', detail: { to: 'pi05' } },
        node_rate: { before: 0.25, after: 0.75, best: 0.75 }, by_task: { grasp: { before: 0, after: 1 } } },
      { round: 2, before: 2, after: 2, best: 2, parent: 1, proposer: 'rules', outcome: 'same', accepted: false, published: false,
        usage: { llm_tokens: null, sim_s: 4 }, tried: { kind: 'none', node: 'grasp-0', detail: { reason: 'r' } },
        node_rate: { before: 0.75, after: 0.75, best: 0.75 }, by_task: { grasp: { before: 1, after: 0.5 } } },
    ]
    const { container } = mount(props({ fetchRsiSeries: vi.fn(() => Promise.resolve(ok(rows))) }))
    await waitFor(() => { expect(screen.getByTestId('rsi-heat')).toBeTruthy() })
    expect(screen.queryByTestId('rsi-face-error')).toBeNull()
    expect(container.querySelectorAll('[data-point]')).toHaveLength(0)
    // the heat strip reads by_task off the same rows
    const cells = [...screen.getByTestId('rsi-heat').querySelectorAll('td[data-task="grasp"]')]
    expect(cells.map(c => c.getAttribute('data-rate'))).toEqual(['1', '0.5'])
    expect(cells.map(c => c.textContent)).toEqual(['\u25b2', '\u25bc'])
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

  it('preserves the pending brief when cancellation fails and allows retry', async () => {
    const cancelBrief = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { code: 'internal', message: 'cancel marker write failed', details: {} } })
      .mockResolvedValueOnce(ok({ brief_id: 'b-new', requested: true }))
    const p = props({ fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok([]))), cancelBrief })
    mount(p)
    await screen.findByText(en['rsi.guide'])
    fireEvent.change(screen.getByPlaceholderText(en['evolve.taskHint']), { target: { value: 'kitchen_thaw' } })
    fireEvent.click(screen.getByRole('button', { name: en['evolve.start'] }))
    await waitFor(() => { expect(screen.getByTestId('rsi-pending').textContent).toContain('b-new') })
    fireEvent.click(screen.getByRole('button', { name: en['evolve.stop'] }))
    await screen.findByText('cancel marker write failed')
    expect(screen.getByTestId('rsi-pending').textContent).toContain('b-new')
    const stop = screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement
    expect(stop.disabled).toBe(false)
    fireEvent.click(stop)
    await waitFor(() => { expect(screen.queryByTestId('rsi-pending')).toBeNull() })
    expect(cancelBrief.mock.calls).toEqual([['b-new', 'session-main'], ['b-new', 'session-main']])
    expect(screen.queryByText('cancel marker write failed')).toBeNull()
  })

  it('shows the submit RPC error without inventing a pending brief', async () => {
    const submitBrief = vi.fn(() => Promise.resolve({ ok: false, error: { code: 'internal', message: 'inbox is read only', details: {} } }))
    mount(props({ fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok([]))), submitBrief }))
    await screen.findByText(en['rsi.guide'])
    fireEvent.change(screen.getByPlaceholderText(en['evolve.taskHint']), { target: { value: 'kitchen_thaw' } })
    fireEvent.click(screen.getByRole('button', { name: en['evolve.start'] }))
    await screen.findByText('inbox is read only')
    expect(screen.queryByTestId('rsi-pending')).toBeNull()
    expect((screen.getByRole('button', { name: en['evolve.start'] }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('starts and resumes with LLM only; stop is disabled with no open brief', async () => {
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
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledWith('{"kind":"evolve","task":"new_task","proposer":"llm","continuous":true,"rounds":0}', 'session-main') })
    expect(screen.getByTestId('rsi-proposer-policy').textContent).toBe(en['rsi.llmOnly'])
    expect(screen.queryByRole('option', { name: en['rsi.proposer.rules'] })).toBeNull()
    // Resuming a historical campaign still submits the LLM-only brief.
    fireEvent.click(chip('pack_lunch'))
    expect(input.value).toBe('pack_lunch')
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: en['evolve.start'] }))
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledWith('{"kind":"evolve","task":"pack_lunch","proposer":"llm","continuous":true,"rounds":0}', 'session-main') })
    expect(p.cancelBrief).not.toHaveBeenCalled()
  })

  it('offers an explicit finite cycle limit without enlarging model or sampling budgets', async () => {
    const p = props({ fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok(campaigns.map(c => ({ ...c, status: 'done', open_brief: null }))))) })
    mount(p)
    await screen.findByRole('combobox', { name: 'Run mode' })
    expect((screen.getByRole('combobox', { name: 'Run mode' }) as HTMLSelectElement).value).toBe('continuous')
    expect(screen.getByTestId('rsi-mode-help').textContent).toContain('without updates')
    fireEvent.change(screen.getByRole('combobox', { name: 'Run mode' }), { target: { value: 'finite' } })
    const limit = screen.getByRole('spinbutton', { name: 'Cycle limit' })
    fireEvent.change(limit, { target: { value: '0' } })
    expect((screen.getByRole('button', { name: en['evolve.start'] }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(limit, { target: { value: '2.5' } })
    expect((screen.getByRole('button', { name: en['evolve.start'] }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(limit, { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: en['evolve.start'] }))
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledWith('{"kind":"evolve","task":"kitchen_thaw","proposer":"llm","continuous":false,"rounds":3}', 'session-main') })
  })

  it('keeps the overall run active after a model stop and distinguishes cycle counters from cumulative resources', async () => {
    const limits = { model_calls: 8, input_bytes: 96000, probe_episodes: 3, output_tokens_per_call: 4096 }
    const cycle = { scope: 'learning_cycle', cycle: 2, limits, used: { model_calls: 1, input_bytes: 1000, probe_episodes: 0, full_evaluations: 0 } }
    const total = { scope: 'submitted_brief', limits: { ...limits, model_calls: null, input_bytes: null, probe_episodes: null }, used: { model_calls: 9, input_bytes: 31000, probe_episodes: 2, full_evaluations: 1 } }
    const r = { round: 3, cycle_outcome: 'abstained', stop_reason: 'model_stop', cycle_budget: { ...cycle, cycle: 1 }, run_budget: { ...total, used: { ...total.used, model_calls: 8 } },
      llm: { status: 'abstained', stop_reason: 'model_stop' }, after: null, after_seeds: [] }
    mount(props({ fetchRsiRun: vi.fn(() => Promise.resolve(ok({
      ...campaign, continuous: true, stop_reason: null, cycle_budget: cycle, run_budget: total,
      latest: r, rounds: [r], live: { phase: 'backoff', cycle: 2, retry_at: Date.now() / 1000 + 30, message: 'No update; continuing.' },
    }))) }))
    await screen.findByTestId('rsi-cycle-backoff')
    expect(screen.getByTestId('rsi-run-state').textContent).toContain('Current cycle 2 · Overall run is still active')
    expect(screen.getByTestId('rsi-cycle-backoff').textContent).toContain('continuing to the next cycle')
    expect(screen.getByTestId('rsi-live-cycle-budget').textContent).toContain('Model calls 1/8')
    expect(screen.getByTestId('rsi-live-run-budget').textContent).toContain('Model calls 9/no total cap')
    expect(screen.getByTestId('rsi-run-budget').textContent).toContain('Model calls 8/no total cap')
    expect(screen.getByTestId('rsi-cycle-outcome').textContent).toContain('Cycle stop reason model_stop')
    expect(screen.getByTestId('rsi-run-state').textContent).not.toContain('Overall stop reason')
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: en['evolve.start'] }) as HTMLButtonElement).disabled).toBe(true)
  })

  it.each([['cancelled', 'cancelled'], ['failed', 'model_error'], ['done', 'round_limit']])('shows an overall %s reason independently of the last model stop', async (status, stop_reason) => {
    mount(props({
      fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok(campaigns.map(c => ({ ...c, status, open_brief: null }))))),
      fetchRsiRun: vi.fn(() => Promise.resolve(ok({ ...campaign, status, continuous: stop_reason !== 'round_limit', stop_reason, cycle_budget: { cycle: 3 }, live: null }))),
    }))
    await screen.findByTestId('rsi-run-state')
    expect(screen.getByTestId('rsi-run-state').textContent).toContain(`Overall stop reason ${stop_reason}`)
    expect(screen.getByTestId('rsi-run-state').textContent).not.toContain('Overall run is still active')
    expect(screen.queryByTestId('rsi-status')).toBeNull()
    expect((screen.getByRole('button', { name: en['evolve.stop'] }) as HTMLButtonElement).disabled).toBe(true)
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
      expect(start().disabled).toBe(true)
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
    expect(confirmLine({ confirm: { seeds: [4247, 4248], before: 0, after: 1 }, published: true }, t as never)).toBe('Confirm seeds 4247,4248 · 0/2 → 1/2 · historically published')
    expect(confirmLine({ confirm: { seeds: [4247, 4248], before: 1, after: 1 }, published: false }, t as never)).toBe('Confirm seeds 4247,4248 · 1/2 → 1/2 · not historically published')
  })
})

describe('describeTried', () => {
  it('humanizes every kind scripts/evolve.py writes', () => {
    const tt = t as unknown as Parameters<typeof describeTried>[1]
    expect(describeTried({ kind: 'tunables', node: 'drop-can1', detail: { path: ['reach_tol'], from: 0.03, to: 0.036 } }, tt)).toBe('drop-can1: reach_tol 0.03 → 0.036')
    expect(describeTried({ kind: 'card', node: 'grasp-0', detail: { to: 'geometric', error: 'boom' } }, tt)).toBe('grasp-0: mount candidate card geometric · boom')
    expect(describeTried({ kind: 'none', node: null as never, detail: { reason: 'every seed succeeded' } }, tt)).toBe('No candidate: every seed succeeded')
    expect(describeTried({ kind: 'mystery', node: 'n' }, tt)).toBe('mystery @ n')
  })

  it('names plan interventions without inventing a target node', () => {
    expect(describeTried({ kind: 'plan', detail: { graph: {} } }, t as never)).toBe('Revise execution plan')
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

describe('TaskHeat / roundSummary (node_rate + by_task rows)', () => {
  const series = [
    { round: 1, before: 0, after: 1, best: 1, node_rate: { before: 0.25, after: 0.5, best: 0.5 },
      by_task: { nav: { before: 0.5, after: 1 }, grasp: { before: 0, after: 0.5 }, drop: { before: 0, after: 0 } } },
    { round: 2, before: 1, after: 1, best: 1, node_rate: { before: 0.5, after: 0.5, best: 0.5 },
      by_task: { nav: { before: 1, after: 1 }, grasp: { before: 0.5, after: 0 }, drop: { before: 0, after: null } } },
  ]

  it('heat strip: tasks in first-seen order × rounds, after (else before) coloured, k/n tooltip, ▲ / ▼ off before', () => {
    const { container } = render(<TaskHeat series={series} n={2} t={t as never} />)
    const heat = screen.getByTestId('rsi-heat') as HTMLDetailsElement
    expect(heat.open).toBe(false)
    fireEvent.click(heat.querySelector('summary') as HTMLElement)
    expect(heat.open).toBe(true)
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

  it('roundSummary reads only backend diagnostics and leaves missing measurements unknown', () => {
    const rates = { node_rate: { before: 0.5, after: 0.75 }, by_task: {
      nav: { before: 1, after: 1 }, grasp: { before: 0.5, after: 1 }, carry: { before: 0, after: 1 }, drop: { before: 0, after: 0 },
    } }
    expect(roundSummary(rates, t as never)).toBe('Nodes passed 50% → 75% · Subtasks nav ✓ grasp ✓ carry ✓ drop ✗')
    expect(roundSummary({ by_task: { grasp: { before: 0.5, after: null } } }, t as never)).toBe('Subtasks grasp 50%')
    expect(roundSummary({ node_rate: { before: 0.25 } }, t as never)).toBe('Nodes passed 25% → —')
    expect(roundSummary(undefined, t as never)).toBe('')
  })
})
