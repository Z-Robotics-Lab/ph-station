// @vitest-environment jsdom
/** Live event publication is independent of slow session details and abandoned reads. */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { foldEvents } from '../src/client/graph.ts'
import type { OpEvent } from '../src/client/graph.ts'
import { useLiveFeed } from '../src/client/useLiveFeed.ts'

const ok = (value: unknown): RemoteResult<unknown> => ({ ok: true, value })
const fast = { current: true }

function deferred() {
  let resolve!: (value: RemoteResult<unknown>) => void
  const promise = new Promise<RemoteResult<unknown>>((done) => { resolve = done })
  return { promise, resolve }
}

function activeRun(start: number, task: string): OpEvent[] {
  return [
    { seq: start, kind: 'task_claimed', task, seed: 1 },
    { seq: start + 1, kind: 'plan_built', goal: task, nodes: [{ id: `${task}-0`, skill: task }] },
    { seq: start + 2, kind: 'node_start', node: `${task}-0`, skill: task },
  ]
}

function board(sessionId: string) {
  const details = deferred()
  const current = activeRun(10, 'current')
  const next = activeRun(1, 'next')
  const log: OpEvent[] = [
    { seq: 1, kind: 'task_claimed', task: 'history' },
    { seq: 2, kind: 'task_done' },
    ...current,
  ]
  const nextDetails = { rows: {}, selected: 'session-next' }
  const injected = {
    sessionId,
    fetchSessions: vi.fn(() => Promise.resolve(ok([
      { name: 'session-main', kinds: { 'runtime.boot': 1 } },
      { name: 'session-next', kinds: { 'runtime.boot': 1 } },
    ]))),
    fetchSession: vi.fn((name: string) => name === 'session-main' ? details.promise : Promise.resolve(ok(nextDetails))),
    fetchRuntimeEvents: vi.fn((name: string, afterSeq: number) => {
      const events = name === 'session-main' ? log : next
      return Promise.resolve(ok({ events: events.filter(e => e.seq > afterSeq), last_seq: events.at(-1)?.seq ?? 0 }))
    }),
    fetchRuntimeFrame: () => Promise.resolve(ok({ error: 'no frame' })),
    fetchKeyframes: () => Promise.resolve(ok({ frames: [], count: 0 })),
    fetchKeyframe: () => Promise.resolve(ok({ error: 'no keyframe' })),
  }
  return { injected, details, current, next, log, nextDetails }
}

async function advance(ms = 0) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useLiveFeed latency and read ownership', () => {
  it('publishes the active run from the first response while session details are pending', async () => {
    const b = board('latency-first-response')
    const h = renderHook(() => useLiveFeed(b.injected, fast))
    await advance()

    expect(b.injected.fetchRuntimeEvents).toHaveBeenCalledExactlyOnceWith('session-main', 0)
    expect(b.injected.fetchSession).toHaveBeenCalledExactlyOnceWith('session-main')
    expect(h.result.current.feed.current).toEqual(b.current)
    expect(h.result.current.sessionRows.current).toBeNull()
    const graph = foldEvents(h.result.current.sessionRows.current, h.result.current.feed.current)
    expect(graph.planNodes.map(node => [node.id, node.status])).toEqual([['current-0', 'running']])
  })

  it('polls further events and publishes a new graph version before details resolve', async () => {
    const b = board('latency-next-events')
    const h = renderHook(() => useLiveFeed(b.injected, fast))
    await advance()
    const firstVersion = h.result.current.version
    b.log.push({ seq: 13, kind: 'node_verified', node: 'current-0' })
    await advance(1200)

    expect(b.injected.fetchRuntimeEvents.mock.calls).toEqual([['session-main', 0], ['session-main', 12]])
    expect(b.injected.fetchSession).toHaveBeenCalledOnce()
    expect(h.result.current.feed.current.at(-1)?.seq).toBe(13)
    expect(h.result.current.sessionRows.current).toBeNull()
    expect(h.result.current.version).toBeGreaterThan(firstVersion)
    expect(foldEvents(null, h.result.current.feed.current).planNodes[0]?.status).toBe('verified')
  })

  it('ignores old events and details that resolve after selecting another session', async () => {
    const b = board('latency-session-switch')
    const h = renderHook(() => useLiveFeed(b.injected, fast))
    await advance()
    const oldEvents = deferred()
    b.injected.fetchRuntimeEvents.mockImplementationOnce(() => oldEvents.promise)
    await advance(1200)
    expect(b.injected.fetchRuntimeEvents).toHaveBeenLastCalledWith('session-main', 12)

    await act(async () => { h.result.current.selectSession('session-next') })
    await advance()
    expect(h.result.current.sessionName).toBe('session-next')
    expect(h.result.current.feed.current).toEqual(b.next)
    expect(h.result.current.sessionRows.current).toEqual(b.nextDetails)
    const nextVersion = h.result.current.version

    await act(async () => {
      oldEvents.resolve(ok({ events: [{ seq: 13, kind: 'node_failed', node: 'current-0' }], last_seq: 13 }))
      b.details.resolve(ok({ rows: {}, selected: 'stale-session-main' }))
    })
    expect(h.result.current.feed.current).toEqual(b.next)
    expect(h.result.current.sessionRows.current).toEqual(b.nextDetails)
    expect(h.result.current.version).toBe(nextVersion)
  })

  it('leaves captured feed refs unchanged when outstanding reads resolve after unmount', async () => {
    const b = board('latency-unmount')
    const h = renderHook(() => useLiveFeed(b.injected, fast))
    await advance()
    const oldEvents = deferred()
    b.injected.fetchRuntimeEvents.mockImplementationOnce(() => oldEvents.promise)
    await advance(1200)
    const state = h.result.current
    const before = [...state.feed.current]
    h.unmount()

    await act(async () => {
      oldEvents.resolve(ok({ events: [{ seq: 13, kind: 'node_failed', node: 'current-0' }], last_seq: 13 }))
      b.details.resolve(ok({ rows: {}, selected: 'unmounted-session-main' }))
    })
    await advance(4800)
    expect(state.feed.current).toEqual(before)
    expect(state.sessionRows.current).toBeNull()
    expect(b.injected.fetchRuntimeEvents).toHaveBeenCalledTimes(2)
  })

  it('keeps one details read in flight across callback identity changes', async () => {
    const b = board('latency-reader-identity')
    const h = renderHook(() => useLiveFeed({ ...b.injected, fetchSession: name => b.injected.fetchSession(name) }, fast))
    await advance()
    h.rerender()
    await advance(16000)
    expect(b.injected.fetchSession).toHaveBeenCalledOnce()
    expect(h.result.current.feed.current).toEqual(b.current)
  })

  it('uses the fast initial follow-up before the consumer has reported an active task', async () => {
    const b = board('latency-first-cadence')
    const idle = { current: false }
    renderHook(() => useLiveFeed(b.injected, idle))
    await advance()
    b.log.push({ seq: 13, kind: 'node_verified', node: 'current-0' })
    await advance(1200)
    expect(b.injected.fetchRuntimeEvents).toHaveBeenLastCalledWith('session-main', 12)
  })

  it('paints once while hidden and pauses both event and details refreshes', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    const b = board('latency-hidden')
    b.details.resolve(ok({ rows: {} }))
    const h = renderHook(() => useLiveFeed(b.injected, fast))
    await advance()
    expect(h.result.current.feed.current).toEqual(b.current)
    expect(h.result.current.sessionRows.current).toEqual({ rows: {} })
    await advance(32000)
    expect(b.injected.fetchSession).toHaveBeenCalledOnce()
    expect(b.injected.fetchRuntimeEvents).toHaveBeenCalledOnce()
  })
})
