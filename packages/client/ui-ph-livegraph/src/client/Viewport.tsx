/**
 * 取景窗 — the live sim viewport overlay: a small floating camera window of the
 * running simulation, dumped offscreen by the harness frames overlay
 * (`runs/<session>/frame.jpg`) and read through the board's `runtimeFrame`
 * face. Renders only: the base64 JPEG is encoded harness-side; this decodes it
 * into an `<img>` and nothing else.
 *
 * Follows the shared run feed's selected session (RunFeedProvider), polls on
 * its own ~1s cadence (paused while the document is hidden or the panel is
 * collapsed), and shows a 无画面 placeholder when no frame exists or the newest
 * one is stale (the runtime is idle or pre-dates the frames overlay).
 *
 * A floating window, not a fixed card: the title bar drags it anywhere inside
 * the graph canvas and a corner handle resizes it (the SplitPane pointer-capture
 * + rAF technique; the image keeps its 4:3 through CSS aspect-ratio). Position,
 * size, and the collapsed state persist per surface in localStorage — the
 * MiniMap-preference pattern. Default dock: the canvas's top-right corner.
 */

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { useRunFeed } from './RunFeed.tsx'
import css from './LiveGraphView.module.css'

/** Poll cadence for the frame read (one storecli spawn per tick). */
const POLL_MS = 1000

/** A frame older than this (by the board's own `age_s`) reads as "no picture":
 * the runtime is idle between tasks or was booted without the frames overlay. */
const STALE_S = 20

/** Draggable-window width range; height follows the 4:3 frame + header. */
const MIN_W = 160
const MAX_W = 560

/** `runtime_frame` payload: a frame, or an error (absent file / bad session). */
interface FramePayload { jpeg_b64?: string; ts?: number; age_s?: number; error?: string }

/** A manually placed window: offsets + width inside the graph canvas. `null`
 * means the default top-right dock (pure CSS, no stored coordinates). */
interface Box { x: number; y: number; w: number }

function readCollapsed(): boolean {
  try { return localStorage.getItem('ph:phlivegraph:viewport') === '1' } catch { return false }
}
function writeCollapsed(collapsed: boolean): void {
  try { localStorage.setItem('ph:phlivegraph:viewport', collapsed ? '1' : '0') } catch { /* private mode: session-only */ }
}

function readBox(): Box | null {
  try {
    const raw = localStorage.getItem('ph:phlivegraph:viewport:box')
    if (raw === null) return null
    const b = JSON.parse(raw) as Box
    return Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.w) ? b : null
  } catch { return null }
}
function writeBox(box: Box | null): void {
  try {
    if (box === null) localStorage.removeItem('ph:phlivegraph:viewport:box')
    else localStorage.setItem('ph:phlivegraph:viewport:box', JSON.stringify(box))
  } catch { /* private mode: session-only */ }
}

/** The viewport overlay window (mounted inside the graph canvas). */
export function Viewport({ t }: PropsLocale<'phlivegraph'>) {
  const { sessionName, fetchRuntimeFrame } = useRunFeed()
  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed())
  const [frame, setFrame] = useState<FramePayload | null>(null)
  const [box, setBox] = useState<Box | null>(() => readBox())
  const boxRef = useRef(box); boxRef.current = box
  const rootRef = useRef<HTMLDivElement>(null)
  const raf = useRef(0)
  const drag = useRef<{ mode: 'move' | 'resize'; px: number; py: number; start: Box } | null>(null)

  // Poll the selected session's frame; a session switch drops the stale image
  // immediately so the viewport never shows another session's kitchen.
  useEffect(() => {
    setFrame(null)
    if (sessionName === null || collapsed) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      if (!alive) return
      if (!document.hidden) {
        // A rejected board read folds to the placeholder, never breaks the loop.
        try {
          const r = await fetchRuntimeFrame(sessionName)
          if (!alive) return
          setFrame(r.ok ? (r.value as FramePayload) : null)
        } catch { setFrame(null) }
      }
      if (!alive) return
      timer = setTimeout(tick, POLL_MS)
    }
    void tick()
    return () => {
      alive = false
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [sessionName, collapsed, fetchRuntimeFrame])

  /** The window's live geometry: the stored box, else the CSS-docked rect
   * measured against the canvas (so the first drag starts from where it sits). */
  const currentBox = (): Box => {
    if (boxRef.current !== null) return boxRef.current
    const el = rootRef.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return { x: 0, y: 0, w: 336 }
    const r = el.getBoundingClientRect()
    const p = parent.getBoundingClientRect()
    return { x: r.left - p.left, y: r.top - p.top, w: r.width }
  }

  /** Keep the window reachable: width in range, origin inside the canvas. */
  const clampBox = (b: Box): Box => {
    const parent = rootRef.current?.offsetParent as HTMLElement | null
    const w = Math.min(MAX_W, Math.max(MIN_W, b.w))
    if (!parent) return { ...b, w }
    return {
      w,
      x: Math.min(Math.max(0, b.x), Math.max(0, parent.clientWidth - w)),
      y: Math.min(Math.max(0, b.y), Math.max(0, parent.clientHeight - 32)),
    }
  }

  // A restored box may be off-canvas after a pane resize; re-clamp once mounted.
  useEffect(() => {
    if (boxRef.current !== null) setBox(clampBox(boxRef.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only re-clamp
  }, [])

  const onDown = (mode: 'move' | 'resize') => (e: ReactPointerEvent<HTMLDivElement>) => {
    // The collapse button lives in the title bar; its click is not a drag.
    if ((e.target as HTMLElement).closest('button') !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { mode, px: e.clientX, py: e.clientY, start: currentBox() }
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d === null || !e.currentTarget.hasPointerCapture(e.pointerId)) return
    const dx = e.clientX - d.px
    const dy = e.clientY - d.py
    const next = d.mode === 'move'
      ? { ...d.start, x: d.start.x + dx, y: d.start.y + dy }
      : { ...d.start, w: d.start.w + dx }
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => { setBox(clampBox(next)) })
  }
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current === null) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    drag.current = null
    writeBox(boxRef.current)
  }

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    writeCollapsed(next)
  }

  const liveFrame = frame?.jpeg_b64 !== undefined && (frame.age_s ?? Infinity) <= STALE_S
    ? frame : null

  const style = box === null ? undefined : {
    left: box.x, top: box.y, right: 'auto' as const,
    ...(collapsed ? {} : { width: box.w }),
  }
  return (
    <div
      ref={rootRef}
      className={`${css.viewport} ${collapsed ? css.viewportCollapsed : ''}`}
      style={style}
    >
      <div
        className={css.viewportHead}
        onPointerDown={onDown('move')}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <span className={css.viewportTitle}>{t('viewport')}</span>
        {liveFrame?.age_s !== undefined && !collapsed
          ? <span className={css.viewportAge}>{liveFrame.age_s.toFixed(0)}s</span>
          : null}
        <button
          type="button" className={css.evClose} onClick={toggle}
          title={t(collapsed ? 'viewportShow' : 'viewportHide')}
          aria-label={t(collapsed ? 'viewportShow' : 'viewportHide')}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      </div>
      {collapsed ? null : liveFrame
        ? (
          <img
            className={css.viewportImg}
            src={`data:image/jpeg;base64,${liveFrame.jpeg_b64}`}
            alt={t('viewport')}
          />
        )
        : <div className={css.viewportNone}>{t('viewportNone')}</div>}
      {collapsed ? null : (
        <div
          className={css.viewportResize}
          onPointerDown={onDown('resize')}
          onPointerMove={onMove}
          onPointerUp={onUp}
          role="separator"
          aria-label={t('viewport')}
        />
      )}
    </div>
  )
}
