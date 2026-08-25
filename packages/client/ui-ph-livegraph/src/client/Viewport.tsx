/**
 * 取景窗 — the live sim viewport overlay: a small camera frame of the running
 * simulation, dumped offscreen by the harness frames overlay
 * (`runs/<session>/frame.jpg`) and read through the board's `runtimeFrame`
 * face. Renders only: the base64 JPEG is encoded harness-side; this decodes it
 * into an `<img>` and nothing else.
 *
 * Follows the shared run feed's selected session (RunFeedProvider), polls on
 * its own ~1s cadence (paused while the document is hidden or the panel is
 * collapsed), and shows a 无画面 placeholder when no frame exists or the newest
 * one is stale (the runtime is idle or pre-dates the frames overlay). The
 * collapsed state persists per surface in localStorage.
 */

import { useEffect, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { useRunFeed } from './RunFeed.tsx'
import css from './LiveGraphView.module.css'

/** Poll cadence for the frame read (one storecli spawn per tick). */
const POLL_MS = 1000

/** A frame older than this (by the board's own `age_s`) reads as "no picture":
 * the runtime is idle between tasks or was booted without the frames overlay. */
const STALE_S = 20

/** `runtime_frame` payload: a frame, or an error (absent file / bad session). */
interface FramePayload { jpeg_b64?: string; ts?: number; age_s?: number; error?: string }

function readCollapsed(): boolean {
  try { return localStorage.getItem('ph:phlivegraph:viewport') === '1' } catch { return false }
}
function writeCollapsed(collapsed: boolean): void {
  try { localStorage.setItem('ph:phlivegraph:viewport', collapsed ? '1' : '0') } catch { /* private mode: session-only */ }
}

/** The viewport overlay card (mounted inside the graph canvas, top-right). */
export function Viewport({ t }: PropsLocale<'phlivegraph'>) {
  const { sessionName, fetchRuntimeFrame } = useRunFeed()
  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed())
  const [frame, setFrame] = useState<FramePayload | null>(null)

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
        // A rejected read folds to the placeholder, never breaks the loop.
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

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    writeCollapsed(next)
  }

  const liveFrame = frame?.jpeg_b64 !== undefined && (frame.age_s ?? Infinity) <= STALE_S
    ? frame : null

  return (
    <div className={`${css.viewport} ${collapsed ? css.viewportCollapsed : ''}`}>
      <div className={css.viewportHead}>
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
    </div>
  )
}
