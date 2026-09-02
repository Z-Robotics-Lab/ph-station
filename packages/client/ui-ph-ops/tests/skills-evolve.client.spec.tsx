// @vitest-environment jsdom
/**
 * Skills + evolve pages: the skills table renders the board's rows and expands
 * to per-executor evidence; the evolve page lists campaigns found through
 * rsiRun, draws the rsiSeries chart as inline SVG, filters the runtime feed to
 * this brief's lines, starts a campaign with a task-only brief, and stops the
 * open brief through cancelBrief. Board faces are mocked at the injected face.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { SkillsView } from '../src/client/SkillsView.tsx'
import { EvolveView } from '../src/client/EvolveView.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const ok = (value: unknown): RemoteResult<unknown> => ({ ok: true, value })
const t = (key: keyof typeof en) => en[key]
const sessions = ok([{ name: 'session-main', kinds: { 'runtime.boot': 1 } }])

describe('SkillsView', () => {
  it('renders the rows and expands one to its by_executor evidence', async () => {
    const props = {
      fetchSessions: vi.fn(() => Promise.resolve(sessions)),
      fetchSkills: vi.fn(() => Promise.resolve(ok([{
        name: 'pick_can', kind: 'segment', description: '', source: 'session',
        bindings: { robocasa: ['pi05', 'scripted'] },
        evidence: { robocasa: { n: 9, k: 5, by_executor: { pi05: { n: 2, k: 1 }, scripted: { n: 7, k: 4 } } } },
        limits: { max_steps: 300 }, failure_modes: ['reach_stall'],
      }]))),
      t,
    }
    render(<SkillsView {...(props as unknown as Parameters<typeof SkillsView>[0])} />)
    await waitFor(() => { expect(screen.getByText('pick_can')).toBeTruthy() })
    expect(props.fetchSkills).toHaveBeenCalledWith('session-main')
    expect(screen.getByText('robocasa')).toBeTruthy()
    expect(screen.getByText('pi05, scripted')).toBeTruthy()
    expect(screen.getByText('9')).toBeTruthy()
    expect(screen.getByText('reach_stall')).toBeTruthy()
    expect(screen.queryByText('scripted: 4/7')).toBeNull()
    fireEvent.click(screen.getByText('pick_can'))
    expect(screen.getByText('scripted: 4/7')).toBeTruthy()
    expect(screen.getByText('pi05: 1/2')).toBeTruthy()
  })

  it('folds to the honest empty state', async () => {
    const props = {
      fetchSessions: vi.fn(() => Promise.resolve(sessions)),
      fetchSkills: vi.fn(() => Promise.resolve(ok([]))),
      t,
    }
    render(<SkillsView {...(props as unknown as Parameters<typeof SkillsView>[0])} />)
    await waitFor(() => { expect(screen.getByText(en['skills.empty'])).toBeTruthy() })
  })
})

describe('EvolveView', () => {
  const campaign = {
    task: 'kitchen_thaw', session: 'session-main', seeds: [1, 3], arm: 'auto', status: 'running',
    best: 2, cursor: 2,
    rounds: [
      { round: 1, tried: { kind: 'executor', node: 'grasp-0', detail: 'pi05' }, before: 1, after: 2, best: 2, published: true, media: ['media/kitchen_thaw/1/grasp-0.mp4'] },
      { round: 2, tried: { kind: 'tunables', node: 'grasp-0', detail: {} }, before: 2, after: 2, best: 2, published: false, media: [] },
    ],
    latest: { round: 2, before: 2, after: 2, best: 2, media: [] },
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
      fetchSessions: vi.fn(() => Promise.resolve(sessions)),
      fetchRuntimeEvents: vi.fn(() => Promise.resolve(ok({ events, last_seq: 5 }))),
      fetchRsiRun: vi.fn((_s: string, task: string) => Promise.resolve(ok(task === 'kitchen_thaw' ? campaign : null))),
      fetchRsiSeries: vi.fn(() => Promise.resolve(ok(
        campaign.rounds.map(({ round, before, after, best }) => ({ round, before, after, best })),
      ))),
      fetchRsiFrames: vi.fn((_s: string, _t: string, round: number) => Promise.resolve(ok(round === 1 ? ['media/kitchen_thaw/1/grasp-0.mp4'] : []))),
      submitBrief: vi.fn(() => Promise.resolve(ok({ submitted: 'b-new', inbox: 'x' }))),
      cancelBrief: vi.fn(() => Promise.resolve(ok({ brief_id: 'b-evolve', requested: true }))),
      t,
      ...over,
    }
  }
  const mount = (p: ReturnType<typeof props>) =>
    render(<EvolveView {...(p as unknown as Parameters<typeof EvolveView>[0])} />)

  it('lists only tasks with a campaign, then shows chart, rounds, media and this brief\'s log', async () => {
    const p = props()
    const { container } = mount(p)
    await waitFor(() => { expect(screen.getByText('kitchen_thaw')).toBeTruthy() })
    expect(p.fetchRsiRun).toHaveBeenCalledWith('session-main', 'pack_lunch')
    expect(screen.queryByText('pack_lunch')).toBeNull()
    fireEvent.click(screen.getByText('kitchen_thaw'))
    await waitFor(() => { expect(container.querySelectorAll('polyline')).toHaveLength(3) })
    expect(p.fetchRsiSeries).toHaveBeenCalledWith('session-main', 'kitchen_thaw')
    expect(container.querySelector('polyline[data-series="best"]')?.getAttribute('points')).toMatch(/^10,10 310,10$/)
    expect(screen.getByText('executor @ grasp-0')).toBeTruthy()
    // Log filtered to the evolve brief: the other brief's lines are gone.
    const log = container.querySelector('pre')?.textContent ?? ''
    expect(log).toContain('"brief":"b-evolve"')
    expect(log).not.toContain('b-other')
    // Round 2 (latest) has no media; picking round 1 fetches its frames.
    expect(screen.getByText(en['evolve.noMedia'])).toBeTruthy()
    fireEvent.click(screen.getAllByText('1')[0]!)
    await waitFor(() => { expect(screen.getByText('media/kitchen_thaw/1/grasp-0.mp4')).toBeTruthy() })
    expect(p.fetchRsiFrames).toHaveBeenCalledWith('session-main', 'kitchen_thaw', 1)
    // The brief is open (claimed, no terminal marker): Stop cancels it.
    fireEvent.click(screen.getByRole('button', { name: en['evolve.stop'] }))
    await waitFor(() => { expect(p.cancelBrief).toHaveBeenCalledWith('b-evolve', 'session-main') })
  })

  it('starts a campaign with a task-only brief and offers resume once it is not open', async () => {
    const p = props({
      fetchRuntimeEvents: vi.fn(() => Promise.resolve(ok({
        events: [...events, { seq: 6, kind: 'task_cancelled', brief: 'b-evolve', task: 'kitchen_thaw' }], last_seq: 6,
      }))),
    })
    mount(p)
    await waitFor(() => { expect(screen.getByText('kitchen_thaw')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText(en['evolve.taskHint']), { target: { value: 'pack_lunch' } })
    fireEvent.click(screen.getByRole('button', { name: en['evolve.start'] }))
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledWith('{"kind":"evolve","task":"pack_lunch"}', 'session-main') })
    // Resume = the same brief resubmitted for a campaign with no open brief.
    fireEvent.click(screen.getByText('kitchen_thaw'))
    fireEvent.click(await screen.findByRole('button', { name: en['evolve.resume'] }))
    await waitFor(() => { expect(p.submitBrief).toHaveBeenCalledWith('{"kind":"evolve","task":"kitchen_thaw"}', 'session-main') })
    expect(p.cancelBrief).not.toHaveBeenCalled()
  })
})
