/** Presentation-only helpers: formatting, never a second statistics layer.
 * Every number arrives already computed by board.store (Python); TS only
 * shapes it for display (×100 for pp with sign, timestamps to local time). */

/** Narrow an unknown JSON value to a finite number, else null. */
export const finite = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Signed percentage-point delta (a rate difference already computed upstream). */
export function pp(delta?: number | null): string {
  const d = finite(delta)
  return d === null ? '—' : `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}`
}

/** Seconds since an epoch mtime, floored — a duration format, not a judgement. */
export function agoSeconds(mtime?: number | null, nowMs: number = Date.now()): number | null {
  const m = finite(mtime)
  if (m === null) return null
  return Math.max(0, Math.floor(nowMs / 1000 - m))
}
