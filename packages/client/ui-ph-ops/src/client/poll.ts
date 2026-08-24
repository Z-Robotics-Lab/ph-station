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
 * @param load - fetch-and-set; called once on mount, on each interval tick while
 * the document is visible, and on every visible transition. Must be stable
 * (wrap in useCallback) — it is the effect's dependency. Its return is ignored,
 * so an async loader may be passed directly (the promise is fire-and-forget).
 */
export function usePolledLoad(load: () => unknown): void {
  useEffect(() => {
    const run = () => { if (!document.hidden) load() }
    run()
    const timer = setInterval(run, POLL_MS)
    document.addEventListener('visibilitychange', run)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', run)
    }
  }, [load])
}
/* jscpd:ignore-end */
