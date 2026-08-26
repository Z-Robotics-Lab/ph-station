/**
 * 取景窗 — the live sim viewport panel: the running simulation's camera frames,
 * dumped offscreen by the harness frames overlay (`runs/<session>/frame.jpg`)
 * and read through the board's `runtimeFrame` face. Registered as its own
 * conversation.view, it docks as the fourth cell of the 实验台 2×2 grid (the
 * dockview splitters resize it; no bespoke drag code). Renders only: the
 * base64 JPEG is encoded harness-side; this decodes it into an `<img>`.
 *
 * Follows the shared run feed's selected session and LONG-POLLS with the
 * `afterTs` cursor + `waitMs`: the board blocks up to `WAIT_MS` until the frame
 * changes past the cursor, and the reply triggers the next request immediately,
 * so the to-hand frame rate tracks the writer's dump rate (the fixed cost per
 * frame is one storecli spawn, no idle poll period). A new frame swaps the
 * `<img>` src through a ref — no large-string prop rides a React re-render.
 * A 无画面 placeholder covers absent or stale frames (the runtime is idle or
 * pre-dates the frames overlay).
 */

import { useEffect, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { useRunFeed } from './RunFeed.tsx'
import css from './LiveGraphView.module.css'

/** Server-side long-poll budget per request: the board re-stats the frame every
 * 10ms up to this long before answering an unchanged cursor. Under the 2s
 * board-side cap; long enough that an idle runtime costs ~1 storecli spawn/s. */
const WAIT_MS = 900

/** Re-poll delay after an error reply or while the tab is hidden — the only
 * client-side pacing left; a healthy long-poll loop re-issues immediately. */
const IDLE_MS = 500

/** A frame older than this (by the board's own `age_s`) reads as "no picture":
 * the runtime is idle between tasks or was booted without the frames overlay. */
const STALE_S = 20

/** `runtime_frame` payload: a frame, an unchanged-cursor ack, or an error. */
interface FramePayload {
  jpeg_b64?: string
  ts?: number
  age_s?: number
  unchanged?: boolean
  error?: string
}

/** The 取景窗 panel body (mounted under a RunFeedProvider). */
export function Viewport({ t }: PropsLocale<'phlivegraph'>) {
  const { sessionName, fetchRuntimeFrame } = useRunFeed()
  const imgRef = useRef<HTMLImageElement>(null)
  const cursor = useRef(0)
  /** Newest known frame age (s), or null when absent — drives the placeholder. */
  const [age, setAge] = useState<number | null>(null)

  useEffect(() => {
    cursor.current = 0
    setAge(null)
    if (sessionName === null) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      if (!alive) return
      if (document.hidden) {
        timer = setTimeout(tick, IDLE_MS)
        return
      }
      // The server paces a healthy loop (unchanged blocks WAIT_MS server-side),
      // so the next request goes out the moment a reply lands; only an error
      // reply — which returns immediately — gets a client-side IDLE_MS delay.
      let delay = 0
      // A rejected board read folds to the placeholder, never breaks the loop.
      try {
        const r = await fetchRuntimeFrame(sessionName, cursor.current, WAIT_MS)
        if (!alive) return
        const p = r.ok ? (r.value as FramePayload) : null
        if (p?.jpeg_b64 !== undefined) {
          cursor.current = p.ts ?? 0
          // src swap through the ref: the JPEG never enters React state, so a
          // ~15Hz frame stream re-renders nothing but the age badge.
          if (imgRef.current) imgRef.current.src = `data:image/jpeg;base64,${p.jpeg_b64}`
          setAge(p.age_s ?? 0)
        } else if (p?.unchanged === true) {
          setAge(p.age_s ?? null)
        } else {
          setAge(null)
          delay = IDLE_MS
        }
      } catch { setAge(null); delay = IDLE_MS }
      if (!alive) return
      timer = setTimeout(tick, delay)
    }
    void tick()
    return () => {
      alive = false
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [sessionName, fetchRuntimeFrame])

  const live = age !== null && age <= STALE_S
  return (
    <div className={css.viewportPanel}>
      <div className={css.viewportHead}>
        <span className={css.viewportTitle}>{t('viewport')}</span>
        {sessionName !== null ? <span className={css.viewportSession}>{sessionName}</span> : null}
        {live ? <span className={css.viewportAge}>{age.toFixed(0)}s</span> : null}
      </div>
      <div className={css.viewportStage}>
        {/* Kept mounted so the ref survives placeholder flips; hidden when stale. */}
        <img
          ref={imgRef}
          className={css.viewportImg}
          style={live ? undefined : { display: 'none' }}
          alt={t('viewport')}
        />
        {live ? null : <div className={css.viewportNone}>{t('viewportNone')}</div>}
      </div>
    </div>
  )
}
