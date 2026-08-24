/** Presentation-only helpers: formatting, never a second statistics layer.
 * Every number arrives already computed by board.store (Python); TS only shapes
 * it for display. The mission-graph status derivation is a pure classification
 * of already-sealed success flags, not a recomputation of any rate. */

/** Narrow an unknown JSON value to a finite number, else null. */
export const finite = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Signed percentage-point delta (a rate difference already computed upstream). */
export function pp(delta?: number | null): string {
  const d = finite(delta)
  return d === null ? '—' : `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}`
}

/** A 0..1 rate as a whole-percent string; em dash when absent. */
export function pct(x?: number | null): string {
  const v = finite(x)
  return v === null ? '—' : `${Math.round(v * 100)}%`
}

/** Seconds since an epoch mtime, floored — a duration format, not a judgement. */
export function agoSeconds(mtime?: number | null, nowMs: number = Date.now()): number | null {
  const m = finite(mtime)
  if (m === null) return null
  return Math.max(0, Math.floor(nowMs / 1000 - m))
}

/** Execute-node/stage rollup state, derived from the already-sealed success
 * flag. `pending` is the plan-present-but-not-yet-run case (no result row). The
 * colors match 战报/演进/账本 exactly: green pass, red fail, neutral pending. */
export type NodeState = 'pass' | 'fail' | 'pending'

/** Classify one execute node/stage from its sealed success flag. */
export function nodeState(success: boolean | null | undefined): NodeState {
  if (success === true) return 'pass'
  if (success === false) return 'fail'
  return 'pending'
}
