/**
 * Shared runtime-feed poller for the merged graph and the 过程流 ticker. It owns
 * the events cursor and the accumulated feed (in refs; polling appends, the
 * caller's fold derives), discovers the newest runtime session, and refreshes
 * the session rows on a slower stride. Renders only — every field is copied
 * verbatim from board payloads.
 *
 * `fast` is read live from a ref each tick so the caller can raise the cadence
 * once its folded model shows an in-flight task without re-arming the timer.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { OpEvent } from './graph.ts'

/** The board reads the feed needs (same face the graph view injects).
 * `fetchRuntimeFrame` is not polled here — the 取景窗 viewport owns its own
 * cadence — but rides the same injected face so panels receive one object. */
export interface FeedInjected {
  fetchSessions: () => Promise<RemoteResult<unknown>>
  fetchSession: (name: string) => Promise<RemoteResult<unknown>>
  fetchRuntimeEvents: (name: string, afterSeq: number) => Promise<RemoteResult<unknown>>
  fetchRuntimeFrame: (name: string, afterTs: number) => Promise<RemoteResult<unknown>>
}

/** One discovered session for the header picker: its name and whether it carries
 * a live runtime marker (a `runtime.boot` chain row). */
export interface SessionMeta { name: string; runtime: boolean }

/** The live feed state a consumer folds into its own view model. */
export interface LiveFeed {
  /** null before the first probe; false when the board bridge is unreachable. */
  online: boolean | null
  sessionName: string | null
  /** Every discovered session, newest first — the header override picker's rows. */
  sessions: SessionMeta[]
  /** Pin the feed to a session by name, overriding the auto-pick (resets the feed). */
  selectSession: (name: string) => void
  /** Accumulated ordered feed; mutated in place, `version` bumps on change. */
  feed: MutableRefObject<OpEvent[]>
  /** Latest `board.session` rows payload (routing + sealed plan source). */
  sessionRows: MutableRefObject<unknown>
  /** Increments whenever `feed` or `sessionRows` changes (a fold trigger). */
  version: number
}

const FAST_MS = 1200
const SLOW_MS = 4000

interface EventsPayload { events?: OpEvent[]; last_seq?: number; error?: string }
interface SessionSummary { name?: string; kinds?: Record<string, number> }

/**
 * The current-runtime session: newest (board sorts sessions mtime-desc) carrying
 * a `runtime.boot` chain row, else the newest of any kind. Shared verbatim by the
 * rail, status bar, and this feed so all three name the same session; a completed
 * campaign store (session-log but no runtime marker) sitting at index 0 no longer
 * hijacks the live surfaces.
 * @param list - board session summaries, newest first.
 * @returns the chosen session name, or null when the list is empty.
 */
export function pickRuntimeSession(list: SessionSummary[]): string | null {
  return (list.find(s => s.kinds?.['runtime.boot'] !== undefined) ?? list[0])?.name ?? null
}

/**
 * Poll the newest runtime session's event feed on an adaptive cadence.
 * @param inj - the three board reads.
 * @param fast - ref read live each tick: true drives the ~1.2s lane, else ~4s.
 * @returns the accumulated feed, session rows, discovery state, and a fold trigger.
 */
export function useLiveFeed(inj: FeedInjected, fast: MutableRefObject<boolean>): LiveFeed {
  const { fetchSessions, fetchSession, fetchRuntimeEvents } = inj
  const [online, setOnline] = useState<boolean | null>(null)
  const [sessionName, setSessionName] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [version, setVersion] = useState(0)
  const cursor = useRef(0)
  const feed = useRef<OpEvent[]>([])
  const sessionRows = useRef<unknown>(null)
  const knownSession = useRef<string | null>(null)
  const override = useRef<string | null>(null)
  const tickNo = useRef(0)

  const load = useCallback(async () => {
    // One Python storecli spawn per tick on the fast lane (the events cursor);
    // session discovery + routing rows refresh on a slower stride.
    tickNo.current += 1
    if (knownSession.current === null || tickNo.current % 4 === 1) {
      const s = await fetchSessions()
      if (!s.ok) { setOnline(false); return }
      setOnline(true)
      const list = s.value as SessionSummary[]
      setSessions(list.map(x => ({ name: x.name ?? '', runtime: x.kinds?.['runtime.boot'] !== undefined })))
      // Operator override wins while it names a live session; else auto-pick the
      // current-runtime session (never the mtime-newest completed campaign).
      const ovr = override.current
      const chosen = (ovr !== null && list.some(x => x.name === ovr)) ? ovr : pickRuntimeSession(list)
      if (chosen !== knownSession.current) {
        // The chosen session changed (override, first probe, or a new runtime
        // session appeared) — drop the old feed so the graph/ticker do not blend
        // two sessions' events.
        knownSession.current = chosen
        cursor.current = 0
        feed.current = []
        sessionRows.current = null
        setVersion(v => v + 1)
      }
      setSessionName(chosen)
    }
    const name = knownSession.current
    if (name === null) return

    const ev = await fetchRuntimeEvents(name, cursor.current)
    if (ev.ok) {
      const payload = ev.value as EventsPayload
      const lastSeq = payload.last_seq ?? 0
      if (lastSeq < cursor.current) {
        cursor.current = 0
        feed.current = []
        const again = await fetchRuntimeEvents(name, 0)
        if (again.ok) {
          const p2 = again.value as EventsPayload
          feed.current = p2.events ?? []
          cursor.current = p2.last_seq ?? 0
        }
        setVersion(v => v + 1)
      } else if (payload.events?.length) {
        feed.current = [...feed.current, ...payload.events]
        cursor.current = lastSeq
        setVersion(v => v + 1)
      }
    }
    if (sessionRows.current === null || tickNo.current % 4 === 1) {
      const d = await fetchSession(name)
      if (d.ok) { sessionRows.current = d.value; setVersion(v => v + 1) }
    }
  }, [fetchSessions, fetchSession, fetchRuntimeEvents])

  // Pin the feed to an operator-chosen session: force a rediscovery (which re-picks
  // `chosen` = the override and resets the feed) on the next tick, then poke it now.
  const selectSession = useCallback((name: string) => {
    override.current = name
    knownSession.current = null
    void load()
  }, [load])

  // Adaptive cadence: reschedule after every tick reading `fast` live; hidden
  // documents skip the fetch except the first, which runs regardless of
  // visibility so a feed mounted while its tab is hidden still paints once
  // (matches usePolledLoad / VaultView).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let alive = true
    let first = true
    const tick = async () => {
      if (!alive) return
      if (first || !document.hidden) {
        // A rejected board read (an assembly fault, not a carrier ok:false) must
        // fold to offline, never throw out of this loop: a throw here skips the
        // reschedule below and stops the feed permanently. The next tick reruns.
        try { await load() } catch { setOnline(false) }
      }
      first = false
      if (!alive) return
      timer = setTimeout(tick, fast.current ? FAST_MS : SLOW_MS)
    }
    void tick()
    const onVisible = () => { if (!document.hidden) void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      if (timer !== undefined) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, fast])

  return { online, sessionName, sessions, selectSession, feed, sessionRows, version }
}
