/**
 * Local two-pane split with one draggable gutter — a pointer-capture + rAF drag
 * (the AppFrame column-handle technique, reimplemented small to stay decoupled).
 * `vertical` swaps columns for rows so the lab can stack the panes when narrow.
 * The ratio persists per `storageKey`.
 */

import { useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import css from './LiveGraphView.module.css'

const MIN = 0.25
const MAX = 0.75
const DEFAULT = 0.58

/** Clamp a raw drag fraction into the pane range. */
export function clampRatio(r: number): number {
  return Math.min(MAX, Math.max(MIN, r))
}

export function SplitPane({ left, right, vertical, storageKey }: {
  left: ReactNode
  right: ReactNode
  vertical: boolean
  storageKey: string
}) {
  const [ratio, setRatio] = useState(() => {
    const v = Number(localStorage.getItem(storageKey))
    return v >= MIN && v <= MAX ? v : DEFAULT
  })
  const wrapRef = useRef<HTMLDivElement>(null)
  const raf = useRef(0)

  const onDown = (e: PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId) }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const raw = vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => { setRatio(clampRatio(raw)) })
  }
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    localStorage.setItem(storageKey, String(ratio))
  }

  const pct = `${ratio * 100}%`
  const style = vertical
    ? { gridTemplateRows: `${pct} 8px minmax(0, 1fr)` }
    : { gridTemplateColumns: `${pct} 8px minmax(0, 1fr)` }
  return (
    <div ref={wrapRef} className={`${css.split} ${vertical ? css.splitV : css.splitH}`} style={style}>
      <div className={css.splitPane}>{left}</div>
      <div
        className={`${css.gutter} ${vertical ? css.gutterV : css.gutterH}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        role="separator"
        aria-orientation={vertical ? 'horizontal' : 'vertical'}
      />
      <div className={css.splitPane}>{right}</div>
    </div>
  )
}
