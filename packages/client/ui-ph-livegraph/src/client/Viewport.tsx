/**
 * 取景窗 — the live sim viewport panel: the running simulation's camera frames,
 * dumped offscreen by the harness frames overlay (`runs/<session>/frame.jpg`)
 * and read through the board's `runtimeFrame` face. Registered as its own
 * conversation.view, it docks as the fourth cell of the 实验台 2×2 grid (the
 * dockview splitters resize it; no bespoke drag code). Renders only: the
 * base64 JPEG is encoded harness-side; this decodes it into an `<img>`.
 *
 * Session choice: the header picker defaults to following the shared run
 * feed's selection and can pin any discovered session (panel-local state; the
 * shared selection is untouched). LONG-POLLS with the `afterTs` cursor +
 * `waitMs`: the board blocks up to `WAIT_MS` until the frame changes past the
 * cursor, and the reply triggers the next request immediately, so the to-hand
 * frame rate tracks the writer's dump rate (the fixed cost per frame is one
 * storecli spawn, no idle poll period). A new frame swaps the `<img>` src
 * through a ref — no large-string prop rides a React re-render.
 *
 * A known frame always shows, however old: a top-right age badge reads green
 * within `STALE_S` and grey beyond it (the image desaturates to mark
 * non-live). The placeholder appears only before any frame is known and names
 * the reason: the board's `no frame` error (this session never produced a
 * frame — runtime booted without `--frames`, or nothing ran yet) vs still
 * waiting for the first reply.
 */

import { useEffect, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { SessionOptions, useRunFeed } from './RunFeed.tsx'
import css from './LiveGraphView.module.css'

/** Server-side long-poll budget per request: the board re-stats the frame every
 * 10ms up to this long before answering an unchanged cursor. Under the 2s
 * board-side cap; long enough that an idle runtime costs ~1 storecli spawn/s. */
const WAIT_MS = 900

/** Re-poll delay after an error reply or while the tab is hidden — the only
 * client-side pacing left; a healthy long-poll loop re-issues immediately. */
const IDLE_MS = 500

/** A frame older than this (by the board's own `age_s`) is non-live: the age
 * badge greys and the image desaturates (the runtime is idle between tasks or
 * stopped dumping). The frame stays visible either way. */
const STALE_S = 20

/** `runtime_frame` payload: a frame, an unchanged-cursor ack, or an error. */
interface FramePayload {
  jpeg_b64?: string
  ts?: number
  age_s?: number
  unchanged?: boolean
  error?: string
}

/**
 * Compact frame age: seconds under a minute, then minutes, then hours.
 * @param s - age in seconds.
 * @returns e.g. `3s`, `12m`, `26h`.
 */
export function fmtAge(s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${Math.round(s / 3600)}h`
}

/** The 取景窗 panel body (mounted under a RunFeedProvider). */
export function Viewport({ t }: PropsLocale<'phlivegraph'>) {
  const { sessionName, sessions, fetchRuntimeFrame } = useRunFeed()
  const imgRef = useRef<HTMLImageElement>(null)
  const cursor = useRef(0)
  /** Panel-local pin: null follows the shared selection. */
  const [pin, setPin] = useState<string | null>(null)
  /** Newest known frame age (s); null until a frame has been shown. */
  const [age, setAge] = useState<number | null>(null)
  /** True once the board answered `no frame` — names the placeholder reason. */
  const [noFrame, setNoFrame] = useState(false)
  const session = pin ?? sessionName

  useEffect(() => {
    cursor.current = 0
    setAge(null)
    setNoFrame(false)
    if (session === null) return
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
        const r = await fetchRuntimeFrame(session, cursor.current, WAIT_MS)
        if (!alive) return
        const p = r.ok ? (r.value as FramePayload) : null
        if (p?.jpeg_b64 !== undefined) {
          cursor.current = p.ts ?? 0
          // src swap through the ref: the JPEG never enters React state, so a
          // ~15Hz frame stream re-renders nothing but the age badge.
          if (imgRef.current) imgRef.current.src = `data:image/jpeg;base64,${p.jpeg_b64}`
          setAge(p.age_s ?? 0)
          setNoFrame(false)
        } else if (p?.unchanged === true) {
          setAge(p.age_s ?? null)
        } else {
          // `no frame` = the frame file has never existed for this session; any
          // other miss (offline board, transport fault) keeps the last state.
          setNoFrame(p?.error === 'no frame')
          delay = IDLE_MS
        }
      } catch { delay = IDLE_MS }
      if (!alive) return
      timer = setTimeout(tick, delay)
    }
    void tick()
    return () => {
      alive = false
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [session, fetchRuntimeFrame])

  const hasFrame = age !== null
  const live = hasFrame && age <= STALE_S
  return (
    <div className={css.viewportPanel}>
      <div className={css.viewportHead}>
        <span className={css.viewportTitle}>{t('viewport')}</span>
        <select
          className={css.viewportPick}
          value={pin ?? ''}
          onChange={(e) => { setPin(e.target.value === '' ? null : e.target.value) }}
          title={t('viewportPick')}
        >
          <option value="">{t('viewportFollow')}</option>
          <SessionOptions sessions={sessions} t={t} />
          {pin !== null && !sessions.some(s => s.name === pin)
            ? <option value={pin}>{pin}</option>
            : null}
        </select>
        {pin === null && sessionName !== null
          ? <span className={css.viewportSession}>{sessionName}</span>
          : null}
      </div>
      <div className={css.viewportStage}>
        {/* Kept mounted so the ref survives placeholder flips. */}
        <img
          ref={imgRef}
          className={live ? css.viewportImg : `${css.viewportImg} ${css.viewportImgStale}`}
          style={hasFrame ? undefined : { display: 'none' }}
          alt={t('viewport')}
        />
        {hasFrame
          ? (
            <span className={`${css.viewportAgeBadge} ${live ? css.viewportAgeLive : css.viewportAgeStale}`}>
              {live ? fmtAge(age) : `${fmtAge(age)} ${t('viewportAgo')}`}
            </span>
          )
          : (
            <div className={css.viewportNone}>
              {noFrame ? t('viewportNoFrame') : t('viewportWaiting')}
            </div>
          )}
      </div>
    </div>
  )
}
