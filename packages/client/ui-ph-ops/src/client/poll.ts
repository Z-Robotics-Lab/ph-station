/** Shared live-refresh for the ops surfaces: run `load` on mount, re-run every
 * POLL_MS, and skip while the tab is hidden so a backgrounded console burns no
 * board calls. Returning to a visible tab re-runs immediately. Scheduling only —
 * the caller keeps its last-good data and folds a failed load into its own
 * offline state; this hook never observes the result.
 *
 * ponytail: a local twin of ui-ph-panels' usePolledLoad (same POLL_MS, same
 * hidden-tab pause), kept inline so this package needs no dependency on that one
 * for ten lines — as ui-ph-battle already does. Extract to a shared package only
 * if a fourth ph panel package appears. */

/* jscpd:ignore-start */
import { useEffect } from 'react'

/** Live-refresh cadence for every ph surface. Human cadence: the harness
 * evidence layer changes at run / hand-edit speed, not sub-second. */
export const POLL_MS = 15000

/**
 * Run `load` on mount, then every `ms` while the document is visible.
 * @param load - fetch-and-set; called once on mount regardless of visibility,
 * then on each interval tick and every visible transition while the document is
 * visible. Must be stable (wrap in useCallback) — it is the effect's dependency.
 * Its return is ignored, so an async loader may be passed directly (the promise
 * is fire-and-forget).
 * @param ms - refresh cadence; defaults to the evidence-layer POLL_MS. Host
 * vitals pass a shorter one: VRAM moves on its own, without a board write to
 * follow, so the evidence cadence would show a ceiling minutes after it hit.
 */
export function usePolledLoad(load: () => unknown, ms: number = POLL_MS): void {
  useEffect(() => {
    const run = () => { if (!document.hidden) load() }
    // First load runs regardless of visibility: a surface that mounts while its
    // tab is hidden (a backgrounded or occluded console window) must still paint
    // once, or it stays on its empty render until a visible transition a
    // persistently-hidden tab never receives. Only the refresh cadence pauses
    // while hidden, so a background console still burns no board calls after it.
    load()
    const timer = setInterval(run, ms)
    document.addEventListener('visibilitychange', run)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', run)
    }
  }, [load, ms])
}
/* jscpd:ignore-end */
