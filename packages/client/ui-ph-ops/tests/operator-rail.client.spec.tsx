// @vitest-environment jsdom
/**
 * Operator-rail smoke: the four cards (mission map, progress, runtime vitals,
 * RSI ticker) must render without throwing and fold to their honest empty
 * states when the board returns nothing, and the collapsed 56px rail must render
 * when the column is an icon rail. Board reads are mocked at the injected face;
 * this asserts the render contract, not the fold (poll.ts owns cadence).
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { OperatorRail } from '../src/client/OperatorRail.tsx'
import css from '../src/client/ops.module.css'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const ok = (value: unknown): RemoteResult<unknown> => ({ ok: true, value })
const fail = (message: string): RemoteResult<unknown> =>
  ({ ok: false, error: { message } } as unknown as RemoteResult<unknown>)

/**
 * Render OperatorRail with every board read mocked to one result, `over`
 * replacing individual faces.
 */
function renderRail(wide: boolean, result: RemoteResult<unknown>, over: object = {}) {
  const props = {
    wide,
    fetchSessions: vi.fn(() => Promise.resolve(result)),
    fetchSession: vi.fn(() => Promise.resolve(result)),
    fetchSessionProgress: vi.fn(() => Promise.resolve(result)),
    fetchRuntimeStatus: vi.fn(() => Promise.resolve(result)),
    fetchRuntimeEvents: vi.fn(() => Promise.resolve(result)),
    fetchStores: vi.fn(() => Promise.resolve(result)),
    fetchRsiCampaigns: vi.fn(() => Promise.resolve(result)),
    fetchHostVitals: vi.fn(() => Promise.resolve(result)),
    modelServer: vi.fn(() => Promise.resolve(result)),
    policyServer: vi.fn(() => Promise.resolve(result)),
    restartServices: vi.fn(() => Promise.resolve(result)),
    fetchHealth: vi.fn(() => Promise.resolve(result)),
    t: (key: keyof typeof en, params?: Record<string, unknown>) =>
      en[key].replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k])),
    ...over,
  }
  const view = render(<OperatorRail {...(props as unknown as Parameters<typeof OperatorRail>[0])} />)
  return { props, view }
}

describe('OperatorRail smoke', () => {
  it('folds to empty states when the board returns no sessions', async () => {
    renderRail(true, ok([]))
    // The rail header and the four cards paint immediately (no session needed).
    expect(screen.getByText(en['rail.title'])).toBeTruthy()
    expect(screen.getByText(en['card.mission'])).toBeTruthy()
    expect(screen.getByText(en['card.progress'])).toBeTruthy()
    expect(screen.getByText(en['card.vitals'])).toBeTruthy()
    expect(screen.getByText(en['card.evolution'])).toBeTruthy()
    // Honest empties: no sealed run, no campaign.
    await waitFor(() => { expect(screen.getByText(en['graph.empty'])).toBeTruthy() })
    expect(screen.getByText(en.noCampaign)).toBeTruthy()
  })

  it('headlines the evolution session\'s first rsiCampaigns row (running first, off disk), legacy tally beneath', async () => {
    const list = [
      { name: 'session-exec', mode: 'execution', runtime_alive: true, kinds: { 'runtime.boot': 1 } },
      { name: 'session-evo', mode: 'evolution', runtime_alive: true, kinds: { 'runtime.boot': 1 } },
    ]
    const { props } = renderRail(true, ok(null), {
      fetchSessions: vi.fn(() => Promise.resolve(ok(list))),
      // An empty per-boot feed (just restarted): the card still shows the campaign.
      fetchRuntimeEvents: vi.fn(() => Promise.resolve(ok({ events: [], last_seq: 0 }))),
      fetchRsiCampaigns: vi.fn(() => Promise.resolve(ok([
        { task: 'kitchen_thaw', seeds: [1, 4], best: 3, status: 'running', cursor: 5, rounds: 5, updated: 20, live: null, open_brief: 'b' },
        { task: 'pack_lunch', seeds: [1, 2], best: 1, status: 'done', cursor: 1, rounds: 1, updated: 30, live: null, open_brief: null },
      ]))),
      fetchStores: vi.fn(() => Promise.resolve(ok([{ name: 'rsi-kitchen', generations: 4, promoted: 1 }]))),
    })
    await waitFor(() => { expect(screen.getByText('Round 5 · best 3/4 · running')).toBeTruthy() })
    expect(screen.getByText('kitchen_thaw')).toBeTruthy()
    expect(screen.queryByText('pack_lunch')).toBeNull()
    expect(props.fetchRsiCampaigns).toHaveBeenCalledTimes(1)
    expect(props.fetchRsiCampaigns).toHaveBeenCalledWith('session-evo')
    expect(screen.getByText('rsi-kitchen')).toBeTruthy()
    expect(screen.getByText(/1\/4/)).toBeTruthy()
  })

  it('renders without throwing when the board read fails (offline)', async () => {
    const { props } = renderRail(true, fail('board bridge not mounted'))
    // A rejected/failed read folds to offline but never blanks the rail.
    expect(screen.getByText(en['rail.title'])).toBeTruthy()
    expect(screen.getByText(en['graph.empty'])).toBeTruthy()
    await waitFor(() => { expect(props.fetchSessions).toHaveBeenCalled() })
  })

  it('renders without throwing when the read throws (assembly fault)', () => {
    renderRail(true, ok([]), {
      fetchSessions: vi.fn(() => Promise.reject(new Error('codec'))),
      fetchHostVitals: vi.fn(() => Promise.reject(new Error('codec'))),
      modelServer: vi.fn(() => Promise.reject(new Error('codec'))),
    })
    expect(screen.getByText(en['rail.title'])).toBeTruthy()
  })

  it('warns in red on a nearly-full GPU and names the process holding it', async () => {
    const { view: { container } } = renderRail(true, ok([]), {
      fetchHostVitals: vi.fn(() => Promise.resolve(ok({
        gpu: [{
          index: 0, name: 'NVIDIA GeForce RTX 4090 D', used_mib: 23000, total_mib: 24564,
          procs: [{ pid: 1125316, name: 'sglang::scheduler', used_mib: 20728 }],
        }],
        ram: { used_gb: 18.8, total_gb: 62.6 },
        disk: { path: '/runs', free_gb: 71.3, total_gb: 592.9 },
        ts: 1787864763,
      }))),
    })

    // 23000/24564 = 94%: the meter paints the fail hue, which is the whole
    // reason this row exists — a full card kills the resident runtime.
    await waitFor(() => { expect(screen.getByText(/94%/)).toBeTruthy() })
    expect(container.querySelector(`.${css.meterFill}.${css.meterFail}`)).toBeTruthy()
    expect(screen.getByText(/sglang::scheduler/)).toBeTruthy()
    // RAM at 30% and disk at 88% used stay out of the fail hue.
    expect(screen.getByText(/30%/)).toBeTruthy()
    expect(screen.getByText(/71.3 GB free/)).toBeTruthy()
    expect(container.querySelectorAll(`.${css.meterFail}`)).toHaveLength(1)
  })

  it('badges the local model server stopped / loading / running', async () => {
    // Loading is the state that matters: the server holds its port for 1-2
    // minutes before it answers, and without a middle badge that whole window
    // reads as "stopped" and invites a second start.
    const cases = [
      [{ running: false, healthy: false }, en['model.off'], en.modelStart],
      [{ running: true, healthy: false, pid: 4242 }, en['model.loading'], en.modelStop],
      [{ running: true, healthy: true, pid: 4242, vram_mib: 19980 }, en['model.on'], en.modelStop],
    ] as const
    for (const [state, badge, button] of cases) {
      renderRail(true, ok([]), { modelServer: vi.fn(() => Promise.resolve(ok(state))) })
      await waitFor(() => { expect(screen.getByText(badge)).toBeTruthy() })
      expect(screen.getByRole('button', { name: button })).toBeTruthy()
      cleanup()
    }
  })

  it('holds the button down on click until a poll confirms the switch', async () => {
    // The board keeps reporting the process after the SIGTERM — a server takes
    // its time going down, and that is exactly the window under test.
    const modelServer = vi.fn(() => Promise.resolve(ok({ running: true, healthy: true })))
    renderRail(true, ok([]), { modelServer })
    await waitFor(() => { expect(screen.getByText(en['model.on'])).toBeTruthy() })

    screen.getByRole('button', { name: en.modelStop }).click()

    // SIGTERM is not death: the board still reports the process, so the button
    // stays disabled rather than letting a second click land on a live pid.
    await waitFor(() => { expect(modelServer).toHaveBeenCalledWith('stop') })
    await waitFor(() => { expect(screen.getByText(en['model.stopping'])).toBeTruthy() })
    expect(screen.getByRole('button', { name: en.modelStop }).hasAttribute('disabled')).toBe(true)
  })

  it('hands the button back when the action reports an error', async () => {
    const modelServer = vi.fn((action: string) => Promise.resolve(ok(
      action === 'start'
        ? { running: false, healthy: false, error: 'launcher not found' }
        : { running: false, healthy: false })))
    renderRail(true, ok([]), { modelServer })
    await waitFor(() => { expect(screen.getByText(en['model.off'])).toBeTruthy() })

    screen.getByRole('button', { name: en.modelStart }).click()

    // A launcher that cannot run must not leave the only control disabled.
    await waitFor(() => { expect(screen.getByText('launcher not found')).toBeTruthy() })
    expect(screen.getByRole('button', { name: en.modelStart }).hasAttribute('disabled')).toBe(false)
  })

  it('keeps the model switch when host vitals are unreachable', async () => {
    // The two rides fold their own failure: the switch is the operator's only
    // way to free the card, so a dead hostVitals must not take it away.
    renderRail(true, ok([]), {
      fetchHostVitals: vi.fn(() => Promise.reject(new Error('codec'))),
      modelServer: vi.fn(() => Promise.resolve(ok({ running: true, healthy: true }))),
    })
    await waitFor(() => { expect(screen.getByText(en['model.on'])).toBeTruthy() })
    expect(screen.getByText(en['modelServer.note'])).toBeTruthy()
    expect(screen.queryByText(en.noGpu)).toBeNull()
  })

  it('policy Start calls policyServer("start"), Stop calls "stop", sha short beside the badge', async () => {
    const policyServer = vi.fn(() => Promise.resolve(ok({ running: false, serving: false })))
    renderRail(true, ok([]), { policyServer })
    await waitFor(() => { expect(policyServer).toHaveBeenCalledWith('status') })
    expect(screen.getByText(en['policyServer.note'])).toBeTruthy()
    await waitFor(() => { expect(screen.getByRole('button', { name: en.policyStart }).hasAttribute('disabled')).toBe(false) })
    expect(screen.getByRole('button', { name: en.policyStop }).hasAttribute('disabled')).toBe(true)

    screen.getByRole('button', { name: en.policyStart }).click()
    await waitFor(() => { expect(policyServer).toHaveBeenCalledWith('start') })
    cleanup()

    const serving = vi.fn(() => Promise.resolve(ok({ running: true, serving: true, checkpoint_sha: 'deadbeefcafe0123' })))
    renderRail(true, ok([]), { policyServer: serving })
    await waitFor(() => { expect(screen.getByText(en['policy.serving'])).toBeTruthy() })
    expect(screen.getByText('deadbeef')).toBeTruthy()
    expect(screen.getByRole('button', { name: en.policyStart }).hasAttribute('disabled')).toBe(true)
    screen.getByRole('button', { name: en.policyStop }).click()
    await waitFor(() => { expect(serving).toHaveBeenCalledWith('stop') })
  })

  it('restart needs two clicks in the widget and passes the build flag', async () => {
    const restartServices = vi.fn(() => Promise.resolve(ok({ started: true, pid: 1, log: '/l' })))
    renderRail(true, ok([]), { restartServices })
    const first = screen.getByRole('button', { name: en.restart })
    first.click()
    // Armed: the same button now reads as the confirm; nothing fired yet.
    await waitFor(() => { expect(screen.getByRole('button', { name: en['restart.confirm'] })).toBeTruthy() })
    expect(restartServices).not.toHaveBeenCalled()

    screen.getByRole('checkbox').click()
    screen.getByRole('button', { name: en['restart.confirm'] }).click()
    await waitFor(() => { expect(restartServices).toHaveBeenCalledWith(true) })
    expect(restartServices).toHaveBeenCalledTimes(1)
    expect(screen.getByText(en['restart.restarting'])).toBeTruthy()
    expect(screen.getByRole('button', { name: en.restart }).hasAttribute('disabled')).toBe(true)
  })

  it('renders the collapsed 56px rail when the column is an icon rail', () => {
    renderRail(false, ok([]))
    // The collapsed form is dots only under a stable title, no card copy.
    expect(screen.getByTitle('operations')).toBeTruthy()
    expect(screen.queryByText(en['rail.title'])).toBeNull()
  })
})
