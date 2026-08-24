/** Presentation-only helpers: formatting, never a second statistics layer.
 * Every number arrives already computed by board.store (Python); TS only shapes
 * it for display. */

/* jscpd:ignore-start */
/** Narrow an unknown JSON value to a finite number, else null. */
export const finite = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null)

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
/* jscpd:ignore-end */
