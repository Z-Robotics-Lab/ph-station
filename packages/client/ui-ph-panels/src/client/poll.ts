/** Shared live-refresh for the ph panels: run `load` once on mount, re-run every
 * POLL_MS, and skip the refresh while the tab is hidden so a backgrounded console
 * burns no board calls. The first load runs regardless of visibility so a panel
 * that mounts hidden still paints once. Returning to a visible tab re-runs
 * immediately, so a panel left open in another tab refreshes the moment the
 * operator looks back. Scheduling only — the caller keeps its last-good data and
 * folds a failed load into its own offline state; this hook never observes the
 * result. */

import { useEffect } from 'react'

/** Live-refresh cadence for every ph panel. Human cadence: the harness
 * evidence layer changes at run / hand-edit speed, not sub-second. */
export const POLL_MS = 15000

/**
 * Run `load` on mount, then every POLL_MS while the document is visible.
 * @param load - fetch-and-set; called once on mount regardless of visibility,
 * then on each interval tick and every visible transition while the document is
 * visible. Must be stable (wrap in useCallback) — it is the effect's dependency.
 */
export function usePolledLoad(load: () => void): void {
  useEffect(() => {
    const run = () => { if (!document.hidden) load() }
    // First load runs regardless of visibility: a panel that mounts while its
    // tab is hidden (a backgrounded or occluded console window) must still paint
    // once, or it stays on its empty render until a visible transition a
    // persistently-hidden tab never receives. Only the refresh cadence pauses
    // while hidden, so a background console still burns no board calls after it.
    load()
    const timer = setInterval(run, POLL_MS)
    document.addEventListener('visibilitychange', run)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', run)
    }
  }, [load])
}
