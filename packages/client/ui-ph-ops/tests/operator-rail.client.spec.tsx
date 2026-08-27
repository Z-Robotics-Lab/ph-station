// @vitest-environment jsdom
/**
 * Operator-rail smoke: the four cards (mission map, progress, runtime vitals,
 * evolution ticker) must render without throwing and fold to their honest empty
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

/** Render OperatorRail with every board read mocked to one result. */
function renderRail(wide: boolean, result: RemoteResult<unknown>) {
  const props = {
    wide,
    fetchSessions: vi.fn(() => Promise.resolve(result)),
    fetchSession: vi.fn(() => Promise.resolve(result)),
    fetchSessionProgress: vi.fn(() => Promise.resolve(result)),
    fetchRuntimeStatus: vi.fn(() => Promise.resolve(result)),
    fetchStores: vi.fn(() => Promise.resolve(result)),
    fetchRounds: vi.fn(() => Promise.resolve(result)),
    fetchHostVitals: vi.fn(() => Promise.resolve(result)),
    t: (key: keyof typeof en) => en[key],
  }
  render(<OperatorRail {...(props as unknown as Parameters<typeof OperatorRail>[0])} />)
  return props
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
    // Honest empties: no sealed run, no rounds, no campaign.
    await waitFor(() => { expect(screen.getByText(en['graph.empty'])).toBeTruthy() })
    expect(screen.getByText(en.noRounds)).toBeTruthy()
    expect(screen.getByText(en.noCampaign)).toBeTruthy()
  })

  it('renders without throwing when the board read fails (offline)', async () => {
    const props = renderRail(true, fail('board bridge not mounted'))
    // A rejected/failed read folds to offline but never blanks the rail.
    expect(screen.getByText(en['rail.title'])).toBeTruthy()
    expect(screen.getByText(en['graph.empty'])).toBeTruthy()
    await waitFor(() => { expect(props.fetchSessions).toHaveBeenCalled() })
  })

  it('renders without throwing when the read throws (assembly fault)', () => {
    const props = {
      wide: true,
      fetchSessions: vi.fn(() => Promise.reject(new Error('codec'))),
      fetchSession: vi.fn(() => Promise.resolve(ok(null))),
      fetchSessionProgress: vi.fn(() => Promise.resolve(ok(null))),
      fetchRuntimeStatus: vi.fn(() => Promise.resolve(ok(null))),
      fetchStores: vi.fn(() => Promise.resolve(ok([]))),
      fetchRounds: vi.fn(() => Promise.resolve(ok([]))),
      fetchHostVitals: vi.fn(() => Promise.reject(new Error('codec'))),
      t: (key: keyof typeof en) => en[key],
    }
    render(<OperatorRail {...(props as unknown as Parameters<typeof OperatorRail>[0])} />)
    expect(screen.getByText(en['rail.title'])).toBeTruthy()
  })

  it('warns in red on a nearly-full GPU and names the process holding it', async () => {
    const props = {
      wide: true,
      fetchSessions: vi.fn(() => Promise.resolve(ok([]))),
      fetchSession: vi.fn(() => Promise.resolve(ok(null))),
      fetchSessionProgress: vi.fn(() => Promise.resolve(ok(null))),
      fetchRuntimeStatus: vi.fn(() => Promise.resolve(ok(null))),
      fetchStores: vi.fn(() => Promise.resolve(ok([]))),
      fetchRounds: vi.fn(() => Promise.resolve(ok([]))),
      fetchHostVitals: vi.fn(() => Promise.resolve(ok({
        gpu: [{
          index: 0, name: 'NVIDIA GeForce RTX 4090 D', used_mib: 23000, total_mib: 24564,
          procs: [{ pid: 1125316, name: 'sglang::scheduler', used_mib: 20728 }],
        }],
        ram: { used_gb: 18.8, total_gb: 62.6 },
        disk: { path: '/runs', free_gb: 71.3, total_gb: 592.9 },
        ts: 1787864763,
      }))),
      t: (key: keyof typeof en) => en[key],
    }
    const { container } = render(
      <OperatorRail {...(props as unknown as Parameters<typeof OperatorRail>[0])} />)

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

  it('renders the collapsed 56px rail when the column is an icon rail', () => {
    renderRail(false, ok([]))
    // The collapsed form is dots only under a stable title, no card copy.
    expect(screen.getByTitle('operations')).toBeTruthy()
    expect(screen.queryByText(en['rail.title'])).toBeNull()
  })
})
