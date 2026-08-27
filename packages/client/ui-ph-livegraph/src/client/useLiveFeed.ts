/**
 * Shared runtime-feed poller for the merged graph and the 过程流 ticker. It owns
 * the events cursor and the accumulated feed (in refs; polling appends, the
 * caller's fold derives), discovers the newest runtime session, and refreshes
 * the session rows on a slower stride. Renders only — every field is copied
 * verbatim from board payloads.
 *
 * `fast` is read live from a ref each tick so the caller can raise the cadence
 * once its folded model shows an in-flight task without re-arming the timer.
 *
 * The feed is scoped to the mounting conversation by a per-`conversation ×
 * session` seq floor ({@link baseline}); an operator-picked session is exempt.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { OpEvent } from './graph.ts'

/** The board reads the feed needs (same face the graph view injects).
 * `fetchRuntimeFrame` and the two keyframe reads are not polled here — the 取景窗
 * viewport and the 过程流 ticker own their own cadence — but ride the same
 * injected face so panels receive one object. */
export interface FeedInjected {
  fetchSessions: () => Promise<RemoteResult<unknown>>
  fetchSession: (name: string) => Promise<RemoteResult<unknown>>
  fetchRuntimeEvents: (name: string, afterSeq: number) => Promise<RemoteResult<unknown>>
  fetchRuntimeFrame: (name: string, afterTs: number, waitMs: number) => Promise<RemoteResult<unknown>>
  /** Keyframe index for one session: seq/kind/ts triples, no image bytes. */
  fetchKeyframes: (name: string) => Promise<RemoteResult<unknown>>
  /** One keyframe's JPEG by event seq (lazy: viewport entry or click only). */
  fetchKeyframe: (name: string, seq: number) => Promise<RemoteResult<unknown>>
}

/** The board reads plus the dsh conversation the panel is mounted under — the
 * framework-supplied `sessionId` of the `conversation.view` slot, which scopes
 * the feed baseline (see {@link baseline}). A conversation view's own props
 * satisfy this, so panels keep passing `props` straight through. */
export type FeedScope = FeedInjected & { sessionId: string }

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
  /**
   * True while the cursor sits on a conversation floor above 0 (see
   * {@link baseline}). An empty `feed` then means "nothing has happened in this
   * conversation yet", not "this session has no feed", so a consumer must not
   * fall back to the session's last sealed plan — that is exactly the earlier
   * conversation's run the floor exists to hide.
   */
  scoped: boolean
  /** Increments whenever `feed` or `sessionRows` changes (a fold trigger). */
  version: number
}

const FAST_MS = 1200
const SLOW_MS = 4000

/**
 * First seq each `conversation × runtime session` pair is allowed to show,
 * keyed `<sessionId>\0<name>`. The runtime feed is global — one opstream per
 * runtime session, independent of dsh conversations — so without a floor every
 * newly opened conversation replays the previous one's runs. The first poll
 * under a conversation adopts the feed's current tail as that pair's floor and
 * drops the backlog; later mounts (a view-tab switch, or returning to the
 * conversation) reuse the stored floor, so the panel restores the window it was
 * showing instead of re-blanking. A runtime reboot truncates the feed and
 * resets the floor to 0, because everything in the new file is new.
 *
 * Page lifetime only: a reload starts every conversation blank again.
 */
const baseline = new Map<string, number>()

/**
 * The floor a fresh conversation should adopt: the tail, unless a run is still
 * in flight — then the seq just before that run's `task_claimed`, so the run
 * arrives whole. Scans backwards and stops at the first terminal row, because
 * anything before a finished run is history the floor exists to hide.
 * @param events - the rows read for this session, oldest first.
 * @param tail - the feed's `last_seq`, the floor when no run is open.
 * @returns the floor seq.
 */
export function runningSince(events: readonly OpEvent[], tail: number): number {
  for (let i = events.length - 1; i >= 0; i--) {
    const kind = events[i]?.kind
    if (kind === 'task_done' || kind === 'task_failed') return tail
    if (kind === 'task_claimed') return Math.max((events[i]?.seq ?? 0) - 1, 0)
  }
  return tail
}

/** Baseline key: conversation id and runtime session name, NUL-joined. */
function baseKey(sessionId: string, name: string): string {
  return `${sessionId}\u0000${name}`
}

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
 * Keep the previous keyframe index object when the poll returned the same seq
 * set, so an unchanged `keyframes/` listing costs zero re-renders of the (long)
 * 过程流 ticker list. A shrunk result means `opstream.arm()` cleared the
 * directory and these seqs now name a new boot's images.
 * @param prev - the seq→kind index in hand.
 * @param next - the seq→kind index just polled.
 * @returns `prev` when both hold the same seqs, else `next`.
 */
export function mergeIndex(prev: Map<number, string>, next: Map<number, string>): Map<number, string> {
  if (prev.size !== next.size) return next
  for (const seq of next.keys()) if (!prev.has(seq)) return next
  return prev
}

/**
 * Poll the newest runtime session's event feed on an adaptive cadence.
 * @param inj - the three board reads.
 * @param fast - ref read live each tick: true drives the ~1.2s lane, else ~4s.
 * @returns the accumulated feed, session rows, discovery state, and a fold trigger.
 */
export function useLiveFeed(inj: FeedScope, fast: MutableRefObject<boolean>): LiveFeed {
  const { fetchSessions, fetchSession, fetchRuntimeEvents, sessionId } = inj
  const [online, setOnline] = useState<boolean | null>(null)
  const [sessionName, setSessionName] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [version, setVersion] = useState(0)
  const [scoped, setScoped] = useState(false)
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
        const floor = chosen !== null && chosen !== override.current
          ? (baseline.get(baseKey(sessionId, chosen)) ?? 0)
          : 0
        cursor.current = floor
        setScoped(floor > 0)
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
      const key = baseKey(sessionId, name)
      if (name !== override.current && !baseline.has(key)) {
        // This conversation's first look at the auto-followed session: floor the
        // cursor at the current tail and drop the backlog that came with this
        // read, so the panels open blank and fill only with what happens from
        // now on. `feed` is empty here — the only path with no baseline is the
        // reset above. A session the operator picked by hand is never floored:
        // asking for it IS asking for its history.
        // ...except a run still IN FLIGHT, which is the present, not the last
        // conversation's history. `foldRuns` can only open a run at its
        // `task_claimed`, so a floor landing inside a running task leaves 执行图谱
        // permanently empty ("no task running") while 过程流 fills from the same
        // feed — the split the operator saw as "the graph vanished mid-run".
        const floorSeq = runningSince(payload.events ?? [], lastSeq)
        baseline.set(key, floorSeq)
        cursor.current = floorSeq
        setScoped(floorSeq > 0)
      } else if (lastSeq < cursor.current) {
        // Runtime reboot truncated the feed: every row in the new file is new,
        // so the floor drops with the cursor.
        baseline.set(key, 0)
        cursor.current = 0
        setScoped(false)
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
  }, [fetchSessions, fetchSession, fetchRuntimeEvents, sessionId])

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

  return { online, sessionName, sessions, selectSession, feed, sessionRows, version, scoped }
}
