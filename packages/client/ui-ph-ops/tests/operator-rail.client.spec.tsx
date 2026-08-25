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
      t: (key: keyof typeof en) => en[key],
    }
    render(<OperatorRail {...(props as unknown as Parameters<typeof OperatorRail>[0])} />)
    expect(screen.getByText(en['rail.title'])).toBeTruthy()
  })

  it('renders the collapsed 56px rail when the column is an icon rail', () => {
    renderRail(false, ok([]))
    // The collapsed form is dots only under a stable title, no card copy.
    expect(screen.getByTitle('operations')).toBeTruthy()
    expect(screen.queryByText(en['rail.title'])).toBeNull()
  })
})
