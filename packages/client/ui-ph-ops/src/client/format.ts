/** Presentation-only helpers: formatting, never a second statistics layer.
 * Every number arrives already computed by board.store (Python); TS only shapes
 * it for display. */

/* jscpd:ignore-start */
/**
 * Narrow an unknown JSON value to a finite number, else null.
 * @param v - any board payload value.
 * @returns the finite number, or null for anything else (including NaN/Infinity).
 */
export const finite = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * A 0..1 rate as a whole-percent string; em dash when absent.
 * @param x - the rate, or null/undefined when the board has none.
 * @returns e.g. `73%`, or `—` when the value is not a finite number.
 */
export function pct(x?: number | null): string {
  const v = finite(x)
  return v === null ? '—' : `${Math.round(v * 100)}%`
}

/**
 * Seconds since an epoch mtime, floored — a duration format, not a judgement.
 * @param mtime - epoch seconds, or null/undefined when the board has none.
 * @param nowMs - current time in epoch milliseconds; defaults to Date.now().
 * @returns whole elapsed seconds clamped at 0, or null when mtime is absent.
 */
export function agoSeconds(mtime?: number | null, nowMs: number = Date.now()): number | null {
  const m = finite(mtime)
  if (m === null) return null
  return Math.max(0, Math.floor(nowMs / 1000 - m))
}

/**
 * A raw second count as a coarse elapsed label: seconds under a minute, whole
 * minutes under an hour, else `Nh Mm`. Presentation only — callers keep the
 * numeric agoSeconds for any threshold logic (dot colour, staleness).
 * @param secs - non-negative whole seconds, typically from agoSeconds.
 * @returns the elapsed label, e.g. `42s`, `7m`, or `2h 5m`.
 */
export function formatAgo(secs: number): string {
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}
/* jscpd:ignore-end */
