/** Shared live-refresh for the ph panels: run `load` on mount, re-run every
 * POLL_MS, and skip while the tab is hidden so a backgrounded console burns no
 * board calls. Returning to a visible tab re-runs immediately, so a panel left
 * open in another tab refreshes the moment the operator looks back. Scheduling
 * only — the caller keeps its last-good data and folds a failed load into its
 * own offline state; this hook never observes the result. */

import { useEffect } from 'react'

/** Live-refresh cadence for every ph panel. Human cadence: the harness
 * evidence layer changes at run / hand-edit speed, not sub-second. */
export const POLL_MS = 15000

/**
 * @param load - fetch-and-set; called once on mount, on each interval tick
 * while the document is visible, and on every visible transition. Must be
 * stable (wrap in useCallback) — it is the effect's dependency.
 */
export function usePolledLoad(load: () => void): void {
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
