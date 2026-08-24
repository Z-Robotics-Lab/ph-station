/**
 * RunFeedProvider — one runtime feed and one run selection shared by the 执行图谱
 * graph and the 过程流 ticker. In v2 each panel mounted its own `useLiveFeed`
 * (double polling) and only the graph tracked which experiment (`task_claimed →
 * task_done` run) was selected, so the ticker was an undivided cumulative log.
 * v3 hoists both into this context: a single poll, a single {run, playhead,
 * live} selection, so selecting run N (or scrubbing) drives graph AND ticker to
 * the same experiment. Renders only — every field is copied from board payloads.
 *
 * Nesting is a pass-through: a `RunFeedProvider` that finds an ancestor provider
 * reuses it (the dockview dash wraps one root provider; each graph/ticker panel
 * still wraps itself for the standalone-tab case, and folds into the root when
 * docked). Only the root provider polls.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { foldRuns } from './graph.ts'
import type { OpEvent, RunInfo } from './graph.ts'
import { useLiveFeed } from './useLiveFeed.ts'
import type { FeedInjected, LiveFeed } from './useLiveFeed.ts'

const PLAY_MS = 300

/** The shared feed plus run selection both panels read. `headSeq` is the
 * effective playhead: the run's tail while live, or the scrubbed seq. */
export interface RunFeed extends LiveFeed {
  runs: RunInfo[]
  /** Effective selected run index (last run while live). */
  runIndex: number
  run: RunInfo | undefined
  /** Effective playhead seq; Infinity only when no run exists yet. */
  headSeq: number
  live: boolean
  playing: boolean
  pick: (i: number) => void
  seek: (seq: number) => void
  goLive: () => void
  togglePlay: () => void
}

const RunFeedCtx = createContext<RunFeed | null>(null)

/** Read the shared run feed. Throws if no provider is mounted above. */
export function useRunFeed(): RunFeed {
  const v = useContext(RunFeedCtx)
  if (v === null) throw new Error('useRunFeed: no RunFeedProvider above')
  return v
}

/** The root provider: owns the single poll and the run-selection state that the
 * graph's scrubber writes and the ticker reads. */
function RootRunFeed({ inject, children }: { inject: FeedInjected; children: ReactNode }) {
  const fastRef = useRef(false)
  const { online, sessionName, feed, sessionRows, version } = useLiveFeed(inject, fastRef)

  // playhead === null follows the live tail; runIndex === null selects the last run.
  const [playhead, setPlayhead] = useState<number | null>(null)
  const [runIndex, setRunIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)

  const runs = useMemo(() => foldRuns(feed.current), [feed, version])
  const live = playhead === null && (runIndex === null || runIndex === runs.length - 1)
  const effIndex = runIndex ?? (runs.length > 0 ? runs.length - 1 : 0)
  const run: RunInfo | undefined = runs[effIndex]
  const headSeq = playhead ?? (run ? run.lastSeq : Infinity)

  // Fast poll while the newest run is still open and we are following it.
  fastRef.current = live && runs.length > 0 && runs[runs.length - 1]?.status === 'running'

  // Playback: step the playhead through the run's events, ~PLAY_MS each.
  useEffect(() => {
    if (!playing || !run) return
    const seqs = feed.current.filter(e => e.seq >= run.firstSeq && e.seq <= run.lastSeq).map(e => e.seq)
    const id = setInterval(() => {
      setPlayhead((prev) => {
        const from = prev ?? run.firstSeq
        const next = seqs.find(s => s > from)
        if (next === undefined) { setPlaying(false); return run.lastSeq }
        return next
      })
    }, PLAY_MS)
    return () => { clearInterval(id) }
  }, [playing, run, feed])

  const value: RunFeed = {
    online, sessionName, feed, sessionRows, version,
    runs, runIndex: effIndex, run, headSeq, live, playing,
    pick: (i) => { setRunIndex(i); setPlayhead(runs[i] ? runs[i].lastSeq : null); setPlaying(false) },
    seek: (seq) => { setPlayhead(seq); setRunIndex(effIndex) },
    goLive: () => { setPlayhead(null); setRunIndex(null); setPlaying(false) },
    togglePlay: () => { setPlaying(p => !p) },
  }
  return <RunFeedCtx.Provider value={value}>{children}</RunFeedCtx.Provider>
}

/** Provide the shared run feed, reusing an ancestor provider if one exists so a
 * docked graph/ticker panel folds into the dashboard's single feed. */
export function RunFeedProvider({ inject, children }: { inject: FeedInjected; children: ReactNode }) {
  const parent = useContext(RunFeedCtx)
  if (parent !== null) return <>{children}</>
  return <RootRunFeed inject={inject}>{children}</RootRunFeed>
}

/** Rows of the run window a ticker/scrubber consumer sees: `[firstSeq, headSeq]`. */
export function runWindow(feed: readonly OpEvent[], run: RunInfo | undefined, headSeq: number): OpEvent[] {
  if (!run) return []
  return feed.filter(e => e.seq >= run.firstSeq && e.seq <= headSeq)
}
