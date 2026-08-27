/**
 * 过程流 — the execution-process ticker for ONE experiment. It reads the shared
 * {@link useRunFeed} selection, so it shows exactly the run the graph shows:
 * the `task_claimed → task_done` window of the selected run, truncated to the
 * scrubber playhead in replay. Newest-first (plan built → node entered → stage
 * passed/failed → result); the running node's row is accented and tagged 当前,
 * matching the graph's live highlight. A header line names which experiment this
 * is. Renders only — every line is a board event copied verbatim.
 *
 * Keyframes: harness.opstream drops `runs/<session>/keyframes/<seq:06d>-<kind>.jpg`
 * per captured event, so the event `seq` already on every row IS the join key —
 * no correlation logic. The panel polls the cheap INDEX (`runtimeKeyframes`:
 * seq/kind/ts, no bytes) and fetches a row's JPEG (`runtimeKeyframe`) only when
 * its thumbnail enters the viewport or is clicked; clicking opens a lightbox
 * that walks the run's other keyframed rows. A session with no keyframes at all
 * renders byte-identically to the pre-keyframe panel.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconTimeline } from '@deepseek-ai/dsh-client-ui-ph-icons'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { OpEvent } from './graph.ts'
import { runWindow, useRunFeed } from './RunFeed.tsx'
import { mergeIndex } from './useLiveFeed.ts'
import css from './LiveGraphView.module.css'

type T = PropsLocale<'phlivegraph'>['t']
type Tone = 'ok' | 'fail' | 'run' | 'warn' | 'muted'

interface Row { seq: number; icon: string; text: string; sub?: string; tone: Tone; time?: string }

/** Keyframe index refresh: the board read is a directory listing with no image
 * bytes, so one storecli spawn per this period covers the whole panel. */
const INDEX_MS = 3000

/** `runtime_keyframes` payload: the index only (seq/kind/ts, no bytes). */
interface KeyframeIndex { frames?: Array<{ seq: number; kind: string; ts: number }>; count?: number; error?: string }

/** `runtime_keyframe` payload: one frame's image, or `{error: 'no keyframe'}`. */
interface KeyframePayload { jpeg_b64?: string; seq?: number; kind?: string; error?: string }

const TONE_CLASS: Record<Tone, string> = {
  ok: css.tkOk ?? '', fail: css.tkFail ?? '', run: css.tkRun ?? '',
  warn: css.tkWarn ?? '', muted: css.tkMuted ?? '',
}

/** One feed event → one ticker line, or null to drop it (setup/unknown kinds). */
function tickerRow(e: OpEvent, t: T): Row | null {
  switch (e.kind) {
    case 'task_claimed':
      return { seq: e.seq, icon: '◆', text: `${t('tk.claimed')} ${(e.task as string) ?? ''}`,
        ...(e.seed !== undefined ? { sub: `#${e.seed as number}` } : {}), tone: 'muted' }
    case 'plan_built': {
      const n = (e.nodes as unknown[] | undefined)?.length ?? 0
      const rp = (e.replan as number) ?? 0
      return { seq: e.seq, icon: '◇',
        text: rp > 0 ? `${t('tk.replan')} #${rp} · ${n} ${t('node')}` : `${t('tk.planned')} · ${n} ${t('node')}`,
        tone: rp > 0 ? 'warn' : 'run' }
    }
    case 'node_start':
      return { seq: e.seq, icon: '▶', text: `${t('tk.enter')} ${(e.skill as string) ?? (e.node as string)}`,
        sub: e.node as string, tone: 'run' }
    case 'stage_transition':
      return { seq: e.seq, icon: e.success ? '✓' : '✗',
        text: `${t('tk.stage')} ${e.stage as string} ${e.success ? t('tk.pass') : t('tk.fail')}`,
        tone: e.success ? 'ok' : 'fail' }
    case 'actuation_end':
      return { seq: e.seq, icon: '·', text: `${t('tk.act')} ${(e.steps as number) ?? 0} ${t('tk.stepsUnit')}`, tone: 'muted' }
    case 'node_verified':
      return { seq: e.seq, icon: '✓', text: `${t('tk.verified')} ${e.node as string}`, tone: 'ok' }
    case 'node_failed':
      return { seq: e.seq, icon: '✗', text: `${t('tk.failed')} ${e.node as string}`, tone: 'fail' }
    case 'task_done':
      return { seq: e.seq, icon: e.success === false ? '✗' : '✓',
        text: e.success === false ? t('tk.taskFailed') : t('tk.done'), tone: e.success === false ? 'fail' : 'ok' }
    case 'task_failed':
      return { seq: e.seq, icon: '✗', text: t('tk.taskFailed'), tone: 'fail' }
    default:
      // Dropped on purpose alongside setup/unknown kinds: `replan` duplicates the
      // `plan_built` replan>0 row (which also carries the node count) and
      // `plan_complete` duplicates the `task_done` terminal row.
      return null
  }
}

/** Seq of the node_start whose node has not yet reached a terminal event — the
 * step the graph pulses as current, or null when nothing is in flight. */
function activeSeq(feed: readonly OpEvent[]): number | null {
  let open: { id: string; seq: number } | null = null
  for (const e of feed) {
    if (e.kind === 'node_start') open = { id: e.node as string, seq: e.seq }
    else if ((e.kind === 'node_verified' || e.kind === 'node_failed') && open && e.node === open.id) open = null
    else if (e.kind === 'task_done' || e.kind === 'task_failed') open = null
  }
  return open?.seq ?? null
}

/** Fetch one keyframe's JPEG as a data URL; null when the board has none. */
type LoadFrame = (seq: number) => Promise<string | null>

/** A row's keyframe thumbnail. The image is pulled on the row's first
 * intersection with the scroll viewport (native IntersectionObserver — no
 * scroll listener, no library), so a 200-row ticker costs one board read per
 * row the operator actually scrolled to. */
function Thumb({ seq, load, onOpen, t }: { seq: number; load: LoadFrame; onOpen: (seq: number) => void; t: T }) {
  const [src, setSrc] = useState<string | null>(null)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setSrc(null)
    const el = ref.current
    if (el === null) return
    let alive = true
    const io = new IntersectionObserver((entries) => {
      if (!entries.some(e => e.isIntersecting)) return
      io.disconnect()
      void load(seq).then((v) => { if (alive) setSrc(v) })
    })
    io.observe(el)
    return () => { alive = false; io.disconnect() }
  }, [seq, load])

  return (
    <button ref={ref} type="button" className={css.kfThumb} title={t('kf.open')}
      onClick={() => { onOpen(seq) }}
    >
      {src === null
        ? <span className={css.kfThumbWait} />
        : <img className={css.kfThumbImg} src={src} alt={`${t('kf.frame')} #${seq}`} />}
    </button>
  )
}

/** The full-size keyframe overlay: ←/→ walk the run's other keyframed rows,
 * Esc closes. The key listener is capture-phase so the graph's own ←/→ scrubber
 * keys do not also step the playhead while the lightbox is up. */
function Lightbox(
  { seq, seqs, kind, load, onPick, onClose, t }:
  { seq: number; seqs: number[]; kind: string; load: LoadFrame; onPick: (seq: number) => void; onClose: () => void; t: T },
) {
  const [src, setSrc] = useState<string | null>(null)
  const at = seqs.indexOf(seq)
  const prev = at > 0 ? seqs[at - 1] : undefined
  const next = at >= 0 ? seqs[at + 1] : undefined

  useEffect(() => {
    let alive = true
    setSrc(null)
    void load(seq).then((v) => { if (alive) setSrc(v) })
    return () => { alive = false }
  }, [seq, load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && prev !== undefined) onPick(prev)
      else if (e.key === 'ArrowRight' && next !== undefined) onPick(next)
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true) }
  }, [prev, next, onPick, onClose])

  return (
    <div className={css.kfBox} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={css.kfStage} onClick={(e) => { e.stopPropagation() }}>
        {src === null
          ? <div className={css.kfWait}>{t('loading')}</div>
          : <img className={css.kfImg} src={src} alt={`${t('kf.frame')} ${kind} #${seq}`} />}
        <div className={css.kfCap}>
          <button type="button" className={css.kfNav} title={t('kf.prev')} disabled={prev === undefined}
            onClick={() => { if (prev !== undefined) onPick(prev) }}
          >‹</button>
          <span className={css.kfCapText}>{kind} · #{seq}</span>
          <button type="button" className={css.kfNav} title={t('kf.next')} disabled={next === undefined}
            onClick={() => { if (next !== undefined) onPick(next) }}
          >›</button>
          <button type="button" className={css.kfNav} title={t('kf.close')} onClick={onClose}>✕</button>
        </div>
      </div>
    </div>
  )
}

export function TickerView({ t }: PropsLocale<'phlivegraph'>) {
  const { online, feed, version, run, runIndex, headSeq, live, sessionName, fetchKeyframes, fetchKeyframe } = useRunFeed()

  const events = useMemo(
    () => runWindow(feed.current, run, headSeq),
    [feed, version, run, headSeq],
  )
  const active = useMemo(() => activeSeq(events), [events])
  const rows = useMemo(() => {
    // Elapsed is measured from the run's first event (task_claimed ts); omit
    // per row when either ts is absent (ts is an optional feed field).
    const firstTs = events[0]?.ts
    const out: Row[] = []
    for (const e of events) {
      const r = tickerRow(e, t)
      if (!r) continue
      if (e.ts !== undefined && firstTs !== undefined) r.time = `+${(e.ts - firstTs).toFixed(1)}s`
      out.push(r)
    }
    return out.reverse()
  }, [events, t])

  /** seq → kind for every keyframe the session has on disk. */
  const [index, setIndex] = useState<Map<number, string>>(new Map())
  const indexRef = useRef<Map<number, string>>(index)
  /** seq → in-flight-or-settled data URL, so the thumbnail and the lightbox
   * share one board read per frame. A miss deletes its entry, leaving a retry. */
  const cache = useRef(new Map<number, Promise<string | null>>())
  const [open, setOpen] = useState<number | null>(null)

  const load = useCallback<LoadFrame>((seq) => {
    const hit = cache.current.get(seq)
    if (hit !== undefined) return hit
    const pull = (async () => {
      if (sessionName === null) return null
      const r = await fetchKeyframe(sessionName, seq)
      const p = r.ok ? (r.value as KeyframePayload) : null
      return p?.jpeg_b64 === undefined ? null : `data:image/jpeg;base64,${p.jpeg_b64}`
    })().catch(() => null).then((v) => {
      if (v === null) cache.current.delete(seq)
      return v
    })
    cache.current.set(seq, pull)
    return pull
  }, [sessionName, fetchKeyframe])

  useEffect(() => {
    indexRef.current = new Map()
    cache.current = new Map()
    setIndex(indexRef.current)
    setOpen(null)
    if (sessionName === null) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      if (!alive) return
      if (!document.hidden) {
        // A rejected board read (or a board with no keyframe face yet) leaves the
        // index untouched: the panel simply renders no thumbnails.
        try {
          const r = await fetchKeyframes(sessionName)
          if (!alive) return
          const payload = r.ok ? (r.value as KeyframeIndex) : null
          const next = new Map((payload?.frames ?? []).map(f => [f.seq, f.kind] as const))
          const merged = mergeIndex(indexRef.current, next)
          if (merged !== indexRef.current) {
            // opstream.arm() empties keyframes/ with the same truncation that
            // resets the feed, so a shrunk index means these seqs now name a new
            // boot's images — the cached JPEGs are stale.
            if (merged.size < indexRef.current.size) cache.current = new Map()
            indexRef.current = merged
            setIndex(merged)
          }
        } catch { /* board unreachable this tick; the next one re-reads */ }
      }
      if (!alive) return
      timer = setTimeout(tick, INDEX_MS)
    }
    void tick()
    return () => {
      alive = false
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [sessionName, fetchKeyframes])

  // The lightbox walks the keyframed rows of the run on screen, oldest first
  // (rows render newest-first), so ←/→ read as backwards/forwards in time.
  const shots = useMemo(
    () => rows.filter(r => index.has(r.seq)).map(r => r.seq).reverse(),
    [rows, index],
  )
  // A seq that vanished (session switch, re-armed runtime) closes the overlay.
  const openSeq = open !== null && index.has(open) ? open : null

  const label = run
    ? `${t('experiment')} ${runIndex + 1} · ${run.task ?? '?'} #${run.seed ?? '?'} · ${live ? t('live') : t('replay')}`
    : t('processSub')

  return (
    <div className={css.ticker}>
      <div className={css.header}>
        <IconTimeline size={14} />
        <span className={css.headTitle}>{t('process')}</span>
        <span className={css.headSub}>{label}</span>
      </div>
      {rows.length === 0
        ? <div className={css.tickerEmpty}>{t(online === false ? 'unavailable' : 'tickerEmpty')}</div>
        : (
          <ol className={css.tickerList}>
            {rows.map(r => (
              <li key={r.seq} className={`${css.tkRow} ${TONE_CLASS[r.tone]} ${r.seq === active ? css.tkActive : ''}`}>
                <span className={css.tkIcon}>{r.icon}</span>
                <span className={css.tkText}>{r.text}{r.sub ? <span className={css.tkSub}> {r.sub}</span> : null}</span>
                {r.seq === active ? <span className={css.tkCurrent}>{t('tk.current')}</span> : null}
                {r.time ? <span className={css.tkTime}>{r.time}</span> : null}
                {index.has(r.seq) ? <Thumb seq={r.seq} load={load} onOpen={setOpen} t={t} /> : null}
              </li>
            ))}
          </ol>
        )}
      {openSeq !== null
        ? (
          <Lightbox
            seq={openSeq} seqs={shots} kind={index.get(openSeq) ?? ''} load={load}
            onPick={setOpen} onClose={() => { setOpen(null) }} t={t}
          />
        )
        : null}
    </div>
  )
}
