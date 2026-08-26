/**
 * 取景窗 — the live sim viewport panel: the running simulation's camera frames,
 * dumped offscreen by the harness frames overlay (`runs/<session>/frame.jpg`)
 * and read through the board's `runtimeFrame` face. Registered as its own
 * conversation.view, it docks as the fourth cell of the 实验台 2×2 grid (the
 * dockview splitters resize it; no bespoke drag code). Renders only: the
 * base64 JPEG is encoded harness-side; this decodes it into an `<img>`.
 *
 * Follows the shared run feed's selected session and polls fast (~200ms) with
 * the `afterTs` cursor: an unchanged file costs a short `{unchanged}` reply,
 * and a new frame swaps the `<img>` src through a ref — no large-string prop
 * rides a React re-render. A 无画面 placeholder covers absent or stale frames
 * (the runtime is idle or pre-dates the frames overlay).
 */

import { useEffect, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { useRunFeed } from './RunFeed.tsx'
import css from './LiveGraphView.module.css'

/** Poll cadence for the frame read (one storecli spawn per tick; the spawn is
 * ~35ms and an unchanged tick carries no image bytes, so 200ms stays cheap). */
const POLL_MS = 200

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
      if (!document.hidden) {
        // A rejected board read folds to the placeholder, never breaks the loop.
        try {
          const r = await fetchRuntimeFrame(sessionName, cursor.current)
          if (!alive) return
          const p = r.ok ? (r.value as FramePayload) : null
          if (p?.jpeg_b64 !== undefined) {
            cursor.current = p.ts ?? 0
            // src swap through the ref: the JPEG never enters React state, so a
            // 5Hz frame stream re-renders nothing but the age badge.
            if (imgRef.current) imgRef.current.src = `data:image/jpeg;base64,${p.jpeg_b64}`
            setAge(p.age_s ?? 0)
          } else if (p?.unchanged === true) {
            setAge(p.age_s ?? null)
          } else {
            setAge(null)
          }
        } catch { setAge(null) }
      }
      if (!alive) return
      timer = setTimeout(tick, POLL_MS)
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
