// @vitest-environment jsdom
/**
 * Conversation scoping of the runtime feed: the opstream is global, so opening a
 * conversation must not replay the previous one's runs. Drives `useLiveFeed`
 * against a fake board whose event log already holds a backlog and asserts the
 * seq floor — blank on a conversation's first look, restored on remount, and
 * waived for a session the operator picked by hand.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { useLiveFeed } from '../src/client/useLiveFeed.ts'
import type { FeedScope } from '../src/client/useLiveFeed.ts'
import type { OpEvent } from '../src/client/graph.ts'

const ok = <T,>(value: T): RemoteResult<unknown> => ({ ok: true, value })

/** One row of the fake opstream (only `seq` matters to the cursor logic). */
const ev = (seq: number): OpEvent => ({ seq, kind: 'node_start' } as unknown as OpEvent)

/** A fake board over one mutable event log shared by every conversation. */
function board(log: OpEvent[]) {
  return {
    fetchSessions: () => Promise.resolve(ok([
      { name: 'session-main', kinds: { 'runtime.boot': 1 } },
      { name: 'kitchen-thaw-cal', kinds: { 'kernel.mount': 1 } },
    ])),
    fetchSession: () => Promise.resolve(ok({ rows: {} })),
    fetchRuntimeEvents: (name: string, afterSeq: number) => {
      const rows = name === 'session-main' ? log : [ev(1)]
      return Promise.resolve(ok({
        events: rows.filter(e => e.seq > afterSeq),
        last_seq: rows.at(-1)?.seq ?? 0,
      }))
    },
    fetchRuntimeFrame: () => Promise.resolve(ok({ error: 'no frame' })),
    fetchKeyframes: () => Promise.resolve(ok({ frames: [], count: 0 })),
    fetchKeyframe: () => Promise.resolve(ok({ error: 'no keyframe' })),
    fetchRuntimeRollout: () => Promise.resolve(ok({ error: 'no rollout' })),
  }
}

const scope = (sessionId: string, log: OpEvent[]): FeedScope => ({ sessionId, ...board(log) })
const fast = { current: true }

/** One board object per conversation over a shared log, so a re-render (or a
 * second panel of the same conversation) reuses the read identities the
 * poller's effect depends on instead of re-arming its timer. */
function scopes(log: OpEvent[]): (sessionId: string) => FeedScope {
  const made = new Map<string, FeedScope>()
  return (sessionId) => {
    let s = made.get(sessionId)
    if (s === undefined) { s = scope(sessionId, log); made.set(sessionId, s) }
    return s
  }
}

/** One poll tick is ~1.2s on the fast lane — over waitFor's 1s default. */
const TICK = { timeout: 6000 }

afterEach(() => { cleanup() })

describe('useLiveFeed conversation scoping', () => {
  it('opens blank over a backlog, then shows only what happens next', async () => {
    const log = [ev(1), ev(2), ev(3)]
    const h = renderHook(() => useLiveFeed(scope('conv-a', log), fast))
    await waitFor(() => { expect(h.result.current.sessionName).toBe('session-main') }, TICK)
    expect(h.result.current.feed.current).toEqual([])
    // Scoped: the graph must not fall back to the session's sealed plan either.
    expect(h.result.current.scoped).toBe(true)

    log.push(ev(4))
    await waitFor(() => { expect(h.result.current.feed.current).toEqual([ev(4)]) }, TICK)

    // Remounting the same conversation (a view-tab switch) restores its window
    // rather than re-blanking at the newer tail.
    h.unmount()
    const again = renderHook(() => useLiveFeed(scope('conv-a', log), fast))
    await waitFor(() => { expect(again.result.current.feed.current).toEqual([ev(4)]) }, TICK)
  })

  it('starts a different conversation blank at the current tail', async () => {
    const log = [ev(1), ev(2)]
    const a = renderHook(() => useLiveFeed(scope('conv-blank-a', log), fast))
    await waitFor(() => { expect(a.result.current.sessionName).toBe('session-main') }, TICK)
    log.push(ev(3))
    await waitFor(() => { expect(a.result.current.feed.current).toEqual([ev(3)]) }, TICK)

    const b = renderHook(() => useLiveFeed(scope('conv-blank-b', log), fast))
    await waitFor(() => { expect(b.result.current.sessionName).toBe('session-main') }, TICK)
    expect(b.result.current.feed.current).toEqual([])
  })

  it('adopts one floor across the sibling panels of a conversation', async () => {
    // 实验台 docks 执行图谱, 过程流 and 取景窗 as separate slot entries: several
    // pollers, one `baseline` entry. Mounted in one synchronous block, the
    // second read is still in flight while the first writes the floor — the
    // loser must still floor itself, not append the backlog it was handed.
    const log = [ev(1), ev(2), ev(3)]
    const at = scopes(log)
    const graph = renderHook(() => useLiveFeed(at('conv-dock'), fast))
    const ticker = renderHook(() => useLiveFeed(at('conv-dock'), fast))
    await waitFor(() => {
      expect(graph.result.current.scoped).toBe(true)
      expect(ticker.result.current.scoped).toBe(true)
    }, TICK)
    expect(graph.result.current.feed.current).toEqual([])
    expect(ticker.result.current.feed.current).toEqual([])

    // Same floor, so both panels open on the same window.
    log.push(ev(4))
    await waitFor(() => {
      expect(graph.result.current.feed.current).toEqual([ev(4)])
      expect(ticker.result.current.feed.current).toEqual([ev(4)])
    }, TICK)
  })

  it('re-floors on a props-only conversation switch and restores the old window on return', async () => {
    const log = [ev(1), ev(2)]
    const at = scopes(log)
    const h = renderHook(
      ({ id }: { id: string }) => useLiveFeed(at(id), fast),
      { initialProps: { id: 'conv-x' } },
    )
    await waitFor(() => { expect(h.result.current.sessionName).toBe('session-main') }, TICK)
    log.push(ev(3))
    await waitFor(() => { expect(h.result.current.feed.current).toEqual([ev(3)]) }, TICK)

    // A mount point that survives the switch (props change, no remount) must
    // still drop conv-x's window instead of accumulating across conversations.
    h.rerender({ id: 'conv-y' })
    await waitFor(() => { expect(h.result.current.feed.current).toEqual([]) }, TICK)
    log.push(ev(4))
    await waitFor(() => { expect(h.result.current.feed.current).toEqual([ev(4)]) }, TICK)

    // Back to conv-x: its own floor is restored, so it shows everything since
    // it first looked — not conv-y's narrower window.
    h.rerender({ id: 'conv-x' })
    await waitFor(() => { expect(h.result.current.feed.current).toEqual([ev(3), ev(4)]) }, TICK)
  })

  it('replays an operator-picked session in full', async () => {
    const h = renderHook(() => useLiveFeed(scope('conv-pick', [ev(1), ev(2)]), fast))
    await waitFor(() => { expect(h.result.current.sessionName).toBe('session-main') }, TICK)
    expect(h.result.current.feed.current).toEqual([])

    h.result.current.selectSession('kitchen-thaw-cal')
    await waitFor(() => { expect(h.result.current.sessionName).toBe('kitchen-thaw-cal') }, TICK)
    await waitFor(() => { expect(h.result.current.feed.current).toEqual([ev(1)]) }, TICK)
    expect(h.result.current.scoped).toBe(false)
  })
})
