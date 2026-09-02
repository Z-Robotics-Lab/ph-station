/** RSI page: the lightweight evolve loop (look → try → rerun the same seeds →
 * publish when better) as the one RSI surface, structured the way the loop
 * works. Head = task + evolution-mode session + 开始/继续 / 停止; then the
 * session's campaigns (`rsiRun` per task the operational feed saw claimed);
 * then the picked campaign top-down: 状态卡 (status chip, the 看→试→复测→发布
 * stepper on `live.phase`, seed / node / elapsed / ETA), 实时 (the running
 * episode's `runtimeFrame` beside a per-seed board off `live.per_seed_partial`),
 * 轮次时间线 (one chip per round, the running one dashed; click selects), then
 * the selected round — ① 进度 (`rsiSeries` chart), ② 每一轮 (per_seed / tried /
 * result / published / needs), ③ 关键片段 (`rsiFrames` + dropped reasons),
 * ④ 日志 (this brief's runtime feed, humanized; raw JSON behind a toggle). The
 * legacy heavy chain (prereg / blind twin / held-out) sits collapsed at the
 * bottom, rendered by view id through the owner's renderView. Renders only —
 * every count is campaign.json's, written by scripts/evolve.py. */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { formatAgo, seedCount } from './format.ts'
import { evolveSessions, pickEvolveDefault } from './OperatorRail.tsx'
import { usePolledLoad } from './poll.ts'
import type {
  Campaign, CampaignRound, LiveState, RuntimeEvent, RuntimeEventsPayload, SeriesPoint, SessionSummary,
} from './types.ts'
import css from './ops.module.css'

/** The board faces this page drives, injected by the slot registration. */
export interface RsiInjected {
  /** POST /api/board/cards: the task picker's names come from `task_bindings`. */
  fetchCards: () => Promise<RemoteResult<unknown>>
  fetchSessions: () => Promise<RemoteResult<unknown>>
  fetchRuntimeEvents: (session: string) => Promise<RemoteResult<unknown>>
  /** POST /api/board/rsi_run: campaign.json + latest + live, or null when none. */
  fetchRsiRun: (session: string, task: string) => Promise<RemoteResult<unknown>>
  /** POST /api/board/rsi_series: per-round {round, before, after, best}. */
  fetchRsiSeries: (session: string, task: string) => Promise<RemoteResult<unknown>>
  /** POST /api/board/rsi_frames: kept media paths of one round. */
  fetchRsiFrames: (session: string, task: string, round: number) => Promise<RemoteResult<unknown>>
  /** POST /api/board/runtime_frame: the running episode's JPEG past `afterTs`
   * (`{jpeg_b64, ts}`), `{unchanged}` when not, `{error}` when none exists. */
  fetchRuntimeFrame: (session: string, afterTs: number) => Promise<RemoteResult<unknown>>
  /** POST /api/board/submit_brief: the brief JSON, verbatim. */
  submitBrief: (briefJson: string, session: string) => Promise<RemoteResult<unknown>>
  /** POST /api/board/cancel_brief: drop the cancel marker for one brief. */
  cancelBrief: (briefId: string, session: string) => Promise<RemoteResult<unknown>>
}

type T = PropsLocale<'phops'>['t']
interface Card { contributes?: { task_bindings?: string[] } }

const TERMINAL = new Set(['task_done', 'task_failed', 'task_cancelled'])
/** The four beats of one round, in loop order; `live.phase` names one of them. */
const PHASES = ['baseline', 'propose', 'retest', 'publish'] as const
/** Poll cadence: seconds while a campaign runs, slower once it settled. */
const POLL_RUNNING_MS = 2000
const POLL_IDLE_MS = 10000

/** The legacy panels the strict section swaps between, by conversation.view id. */
const STRICT_TABS = [
  { id: 'evolution', label: 'rsi.tab.evolution' },
  { id: 'battle', label: 'rsi.tab.battle' },
  { id: 'ledger', label: 'rsi.tab.ledger' },
] as const

/** The brief ids the feed claimed for `task`, plus the one still open (a
 * `task_claimed` with no terminal marker after it), read verbatim off the
 * board's own markers. */
function briefsOf(events: RuntimeEvent[], task: string): { ids: Set<string>; open: string | null } {
  const ids = new Set<string>()
  let open: string | null = null
  for (const e of events) {
    if (typeof e.brief !== 'string') continue
    if (e.kind === 'task_claimed' && e.task === task) { ids.add(e.brief); open = e.brief }
    else if (TERMINAL.has(e.kind ?? '') && e.brief === open) open = null
  }
  return { ids, open }
}

/** Inline SVG line chart of the series: x = round, y = success count out of
 * `n` seeds. Three polylines (before / after / best) over labelled axes, y
 * ticks 0..n, x labels 第1轮…; no chart library. */
export function SeriesChart({ series, n, t }: { series: SeriesPoint[]; n: number; t: T }) {
  const W = 320; const H = 130; const L = 26; const R = 8; const TOP = 8; const B = 26
  if (series.length === 0) return <div className={css.dim}>{t('rsi.chartEmpty')}</div>
  const top = Math.max(1, n, ...series.flatMap(p => [p.before ?? 0, p.after ?? 0, p.best ?? 0]))
  const step = Math.max(1, Math.ceil(top / 6))
  const ticks: number[] = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  const x = (i: number) => L + (series.length < 2 ? 0 : (i * (W - L - R)) / (series.length - 1))
  const y = (v: number) => H - B - (v / top) * (H - B - TOP)
  const line = (k: 'before' | 'after' | 'best') => series.map((p, i) => `${x(i)},${y(p[k] ?? 0)}`).join(' ')
  const legend: Array<[string, 'before' | 'after' | 'best']> = [[t('evolve.before'), 'before'], [t('evolve.after'), 'after'], [t('evolve.best'), 'best']]
  const cls = { before: css.chartBefore, after: css.chartAfter, best: css.chartBest }
  return (
    <svg className={css.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('evolve.chart')}>
      <line className={css.chartAxis} x1={L} y1={TOP} x2={L} y2={H - B} />
      <line className={css.chartAxis} x1={L} y1={H - B} x2={W - R} y2={H - B} />
      {ticks.map(v => (
        <g key={v}>
          <line className={css.chartGrid} x1={L} y1={y(v)} x2={W - R} y2={y(v)} />
          <text className={css.chartLabel} x={L - 4} y={y(v) + 3} textAnchor="end" data-axis="y">{v}</text>
        </g>
      ))}
      {series.map((p, i) => (
        <text key={p.round ?? i} className={css.chartLabel} x={x(i)} y={H - B + 11} textAnchor="middle" data-axis="x">
          {t('rsi.roundN', { r: p.round ?? i + 1 })}
        </text>
      ))}
      {legend.map(([label, k], i) => (
        <g key={k} data-legend={k}>
          <line className={cls[k]} x1={L + i * 70} y1={H - 4} x2={L + i * 70 + 14} y2={H - 4} />
          <text className={css.chartLabel} x={L + i * 70 + 18} y={H - 1}>{label}</text>
        </g>
      ))}
      <polyline className={css.chartBefore} data-series="before" points={line('before')} />
      <polyline className={css.chartAfter} data-series="after" points={line('after')} />
      <polyline className={css.chartBest} data-series="best" points={line('best')} />
    </svg>
  )
}

/** What one round tried, in operator words: "把 drop-can1 的 reach_tol 0.03 →
 * 0.036" / "drop-can1 换用 pi05 执行器" — the {kind, node, detail} shape
 * scripts/evolve.py writes, shown as a sentence rather than JSON. */
export function describeTried(tried: CampaignRound['tried'], t: T): string {
  const d = (tried?.detail ?? {}) as Record<string, unknown>
  const node = tried?.node ?? '—'
  const s = (v: unknown) => (v === undefined || v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))
  let out: string
  switch (tried?.kind) {
    case 'executor': out = t('rsi.tried.executor', { node, to: s(d.to) }); break
    case 'tunables': out = t('rsi.tried.tunables', { node, path: Array.isArray(d.path) ? d.path.join('.') : s(d.path), from: s(d.from), to: s(d.to) }); break
    case 'card': out = t('rsi.tried.card', { node, to: s(d.to) }); break
    case 'none': out = t('rsi.tried.none', { reason: s(d.reason) }); break
    default: out = `${tried?.kind ?? '—'} @ ${node}`
  }
  return typeof d.error === 'string' ? `${out} · ${d.error}` : out
}

/** One runtime event as an operator sentence: the board's task_claimed /
 * task_done / task_failed / task_cancelled markers get their own words; a
 * round-bearing row (rsi_step) leads with 第 r 轮; anything else shows its
 * kind verbatim plus `message` when the runtime wrote one. */
export function describeEvent(e: RuntimeEvent, t: T): string {
  const msg = typeof e.message === 'string' ? ` ${e.message}` : ''
  switch (e.kind) {
    case 'task_claimed': return t('rsi.log.claimed', { task: e.task ?? '—', brief: e.brief ?? '' })
    case 'task_done': return t('rsi.log.done')
    case 'task_failed': return t('rsi.log.failed', { error: e.error ?? '—' })
    case 'task_cancelled': return t('rsi.log.cancelled')
    default: return typeof e.round === 'number' ? `${t('rsi.roundN', { r: e.round })} · ${e.kind ?? ''}${msg}` : `${e.kind ?? '—'}${msg}`
  }
}

/** Epoch seconds → local HH:MM:SS; `--:--:--` when the row carries no ts. */
const clock = (ts?: number) => (typeof ts === 'number'
  ? new Date(ts * 1000).toTimeString().slice(0, 8)
  : '--:--:--')

/** True while `live` describes a round in flight (one of the four beats). */
const inFlight = (live: LiveState | null | undefined): live is LiveState =>
  live != null && (PHASES as readonly string[]).includes(live.phase ?? '')

export function RsiView({
  fetchCards, fetchSessions, fetchRuntimeEvents, fetchRsiRun, fetchRsiSeries, fetchRsiFrames, fetchRuntimeFrame,
  submitBrief, cancelBrief, renderView, t,
}: ConvViewProps & InjectFace<RsiInjected> & PropsLocale<'phops'>) {
  const [taskNames, setTaskNames] = useState<string[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [session, setSession] = useState<string | null>(null)
  const [events, setEvents] = useState<RuntimeEvent[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [known, setKnown] = useState<string[]>([])
  const [task, setTask] = useState<string | null>(null)
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [round, setRound] = useState<number | null>(null)
  const [frames, setFrames] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState<boolean | null>(null)
  const [strictTab, setStrictTab] = useState<string>(STRICT_TABS[0].id)
  const [raw, setRaw] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [hasFrame, setHasFrame] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const frameTs = useRef(0)

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([fetchCards(), fetchSessions()])
      if (c.ok) {
        const names = new Set<string>()
        for (const card of c.value as Card[]) for (const tk of card.contributes?.task_bindings ?? []) names.add(tk)
        setTaskNames([...names].sort())
      }
      if (!s.ok) { setOnline(false); return }
      setOnline(true)
      const list = s.value as SessionSummary[]
      setSessions(list)
      const name = session ?? pickEvolveDefault(list)
      if (name === null) { setCampaigns([]); return }
      const ev = await fetchRuntimeEvents(name)
      const rows = ev.ok ? ((ev.value as RuntimeEventsPayload | null)?.events ?? []) : []
      setEvents(rows)
      // ponytail: the campaign list is every task the (per-boot) feed saw
      // claimed plus what this page started; a campaigns-directory listing face
      // would survive a reboot — add it when an operator misses one.
      const tasks = new Set(known)
      for (const e of rows) if (e.kind === 'task_claimed' && typeof e.task === 'string') tasks.add(e.task)
      const runs = await Promise.all([...tasks].map(tk => fetchRsiRun(name, tk)))
      setCampaigns(runs.flatMap(r => (r.ok && typeof (r.value as Campaign | null)?.task === 'string' ? [r.value as Campaign] : [])))
      if (task !== null) {
        const sr = await fetchRsiSeries(name, task)
        if (sr.ok) setSeries(Array.isArray(sr.value) ? sr.value as SeriesPoint[] : [])
      }
    } catch {
      setOnline(false)
    }
  }, [fetchCards, fetchSessions, fetchRuntimeEvents, fetchRsiRun, fetchRsiSeries, session, known, task])

  const sessionName = session ?? pickEvolveDefault(sessions)
  const current = campaigns?.find(c => c.task === task) ?? null
  const running = current?.status === 'running'
  // Auto-select: the running campaign (else the first) so the status card shows
  // without a click — a page that says "running" but nothing else is what the
  // operator complained about. Explicit picks (row click / session change) still win.
  useEffect(() => {
    if (task !== null || !campaigns?.length) return
    const c = campaigns.find(x => x.status === 'running') ?? campaigns[0]
    if (typeof c?.task === 'string') { setTask(c.task); setDraft(c.task) }
  }, [campaigns, task])
  usePolledLoad(load, running ? POLL_RUNNING_MS : POLL_IDLE_MS)
  const live = inFlight(current?.live) ? current.live : null
  const shownRound = round ?? current?.latest?.round ?? null
  const shown = current?.rounds?.find(r => r.round === shownRound) ?? null

  useEffect(() => {
    if (sessionName === null || task === null || shownRound === null) { setFrames([]); return }
    let alive = true
    fetchRsiFrames(sessionName, task, shownRound)
      .then((r) => { if (alive && r.ok) setFrames(Array.isArray(r.value) ? r.value as string[] : []) })
      .catch(() => { if (alive) setFrames([]) })
    return () => { alive = false }
  }, [fetchRsiFrames, sessionName, task, shownRound])

  // One 1s tick while running: the elapsed clock and the live frame (src swapped
  // through the ref so the JPEG never rides a React re-render).
  useEffect(() => {
    frameTs.current = 0; setHasFrame(false)
    if (!running || sessionName === null) return
    let alive = true
    const tick = async () => {
      setNow(Date.now())
      if (document.hidden) return
      try {
        const r = await fetchRuntimeFrame(sessionName, frameTs.current)
        const p = r.ok ? r.value as { jpeg_b64?: string; ts?: number } | null : null
        if (alive && p?.jpeg_b64 !== undefined) {
          frameTs.current = p.ts ?? 0
          if (imgRef.current) imgRef.current.src = `data:image/jpeg;base64,${p.jpeg_b64}`
          setHasFrame(true)
        }
      } catch { /* the last frame stays; the next tick retries */ }
    }
    void tick()
    const timer = setInterval(() => { void tick() }, 1000)
    return () => { alive = false; clearInterval(timer) }
  }, [fetchRuntimeFrame, running, sessionName])

  const { ids, open } = task === null ? { ids: new Set<string>(), open: null } : briefsOf(events, task)
  const log = events.filter(e => (typeof e.brief === 'string' ? ids.has(e.brief) : e.task === task))

  /** Start or resume: the brief is `{kind:"evolve", task}` and nothing else;
   * the runtime continues a known task from campaign.json's cursor. */
  const start = useCallback(async () => {
    const tk = draft.trim()
    if (sessionName === null || tk === '') return
    setBusy(true); setError(null)
    try {
      const r = await submitBrief(JSON.stringify({ kind: 'evolve', task: tk }), sessionName)
      const v = r.ok ? r.value as { submitted?: string; error?: string } | null : null
      if (v?.submitted === undefined) { setError(v?.error ?? t('brain.transportFail')); return }
      setSession(sessionName)
      setKnown(k => (k.includes(tk) ? k : [...k, tk]))
      setTask(tk); setRound(null)
    } catch {
      setError(t('brain.transportFail'))
    } finally {
      setBusy(false)
    }
  }, [submitBrief, sessionName, draft, t])

  const stop = useCallback(async () => {
    if (sessionName === null || open === null) return
    setBusy(true); setError(null)
    try {
      const r = await cancelBrief(open, sessionName)
      const v = r.ok ? r.value as { error?: string } | null : null
      if (v?.error !== undefined) setError(v.error)
    } catch {
      setError(t('brain.transportFail'))
    } finally {
      setBusy(false)
    }
  }, [cancelBrief, sessionName, open, t])

  const pick = (c: Campaign) => { setTask(c.task ?? null); setRound(null); setDraft(c.task ?? '') }

  if (online === false) return <div className={css.state}>{t('unavailable')}</div>
  if (campaigns === null) return <div className={css.state}>{t('loading')}</div>
  const n = current === null ? 0 : seedCount(current)
  const rounds = current?.rounds ?? []
  const liveRound = live?.round ?? (rounds.length + 1)
  return (
    <div className={css.page}>
      <div className={css.pageHead}>
        <label>{t('evolve.task')} <input list="ph-rsi-tasks" value={draft} placeholder={t('evolve.taskHint')}
          onChange={(e) => { setDraft(e.target.value) }} /></label>
        <datalist id="ph-rsi-tasks">{taskNames.map(n => <option key={n} value={n} />)}</datalist>
        <label>{t('brain.session')} <select value={sessionName ?? ''} onChange={(e) => { setSession(e.target.value); setTask(null) }}>
          {evolveSessions(sessions).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select></label>
        <button type="button" disabled={busy || draft.trim() === '' || sessionName === null} onClick={() => { void start() }}>
          {busy ? t('evolve.starting') : t('evolve.start')}
        </button>
        <button type="button" disabled={busy || open === null} onClick={() => { void stop() }}>{t('evolve.stop')}</button>
        {error !== null && <span className={css.brainError}>{error}</span>}
      </div>

      {campaigns.length > 0 && (
        <table className={css.table}>
          <thead><tr>
            <th>{t('evolve.task')}</th><th>{t('evolve.status')}</th><th>{t('evolve.rounds')}</th>
            <th>{t('evolve.best')}</th><th>{t('evolve.tried')}</th>
          </tr></thead>
          <tbody>
            {campaigns.map(c => (
              <tr key={c.task} className={`${css.rowBtn} ${c.task === task ? css.rowSelected : ''}`} onClick={() => { pick(c) }}>
                <td className={css.mono}>{c.task}</td>
                <td>{c.status}</td>
                <td className={css.mono}>{c.rounds?.length ?? 0}</td>
                <td className={css.mono}>{c.best}/{seedCount(c)}</td>
                <td>{c.latest ? describeTried(c.latest.tried, t) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {current === null
        ? <div className={css.state}>{t('rsi.guide')}</div>
        : (
          <>
            <div className={`${css.card} ${css.statusCard}`} data-testid="rsi-status">
              <div className={css.statusRow}>
                <b className={css.mono}>{current.task}</b>
                <span className={`${css.dim} ${css.mono}`}>{current.session ?? sessionName}</span>
                <StatusChip status={current.status} t={t} />
                <span className={css.mono}>{t('evolve.best')} {current.best ?? 0}/{n}</span>
              </div>
              {live !== null
                ? (
                  <>
                    <div className={css.statusRow}>
                      <span>{t('rsi.roundN', { r: liveRound })}</span>
                      <div className={css.stepper}>
                        {PHASES.map((ph, i) => (
                          <span key={ph}>
                            {i > 0 && <span className={css.stepArrow}> → </span>}
                            <span className={css.step} data-phase={ph} aria-current={live.phase === ph ? 'step' : undefined}>{t(`rsi.phase.${ph}`)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className={css.statusRow}>
                      <span>{t('rsi.seedLine', { i: live.seed_index ?? 0, n: live.seeds_total ?? n, seed: live.seed ?? '—', node: live.node ?? '—' })}</span>
                      <Elapsed live={live} now={now} t={t} />
                    </div>
                    {typeof live.message === 'string' && live.message !== '' && <div className={css.dim}>{live.message}</div>}
                  </>
                )
                : running && <div className={css.dim}>{t('rsi.noLive')}</div>}
            </div>

            {running && (
              <>
                <h3 className={css.secTitle}>{t('rsi.sec.live')}</h3>
                <div className={css.liveGrid}>
                  <div>
                    <img ref={imgRef} className={css.liveFrame} alt={t('rsi.sec.live')} hidden={!hasFrame} />
                    {!hasFrame && <div className={css.dim}>{t('rsi.noFrame')}</div>}
                  </div>
                  {live !== null && <SeedBoard live={live} seeds={current.seeds} t={t} />}
                </div>
              </>
            )}

            <h3 className={css.secTitle}>{t('rsi.sec.timeline')}</h3>
            <div className={css.timeline}>
              {rounds.map(r => (
                <button key={r.round} type="button" className={css.tlChip} aria-pressed={r.round === shownRound} onClick={() => { setRound(r.round ?? null) }}>
                  <span><b>{t('rsi.roundN', { r: r.round ?? 0 })}</b> <span className={css.mono}>{r.before} → {r.after}</span> · {r.published === true ? '✓' : '–'}</span>
                  <span className={css.tlTried}>{describeTried(r.tried, t)}</span>
                </button>
              ))}
              {live !== null && (
                <button type="button" className={css.tlChip} data-running="true" aria-pressed={liveRound === shownRound} onClick={() => { setRound(liveRound) }}>
                  <span><b>{t('rsi.roundN', { r: liveRound })}</b> · {t(`rsi.phase.${live.phase as typeof PHASES[number]}`)}</span>
                  <span className={css.tlTried}>{live.tried ? describeTried(live.tried, t) : t('rsi.seed.running')}</span>
                </button>
              )}
            </div>

            <h3 className={css.secTitle}>{t('rsi.sec.progress')} <span className={css.dim}>{t('evolve.chart')}</span></h3>
            <SeriesChart series={series} n={n} t={t} />

            <h3 className={css.secTitle}>{t('rsi.sec.rounds')}</h3>
            {shown !== null
              ? <RoundCard r={shown} t={t} />
              : <div className={css.dim}>{t('rsi.roundRunning')}</div>}

            <h3 className={css.secTitle}>{t('rsi.sec.frames')}{shownRound !== null ? ` · ${t('rsi.roundN', { r: shownRound })}` : ''}</h3>
            {frames.length === 0
              ? <div className={css.dim}>{t('evolve.noMedia')}</div>
              : <div className={css.media}>{frames.map(p => <MediaCard key={p} session={sessionName ?? ''} path={p} />)}</div>}
            {Object.entries(shown?.media_dropped ?? {}).map(([k, why]) => (
              <div key={k} className={css.dim}><span className={css.mono}>{k}</span> · {t('rsi.dropped')}: {why}</div>
            ))}

            <h3 className={css.secTitle}>{t('rsi.sec.log')}
              <label className={css.dim}><input type="checkbox" checked={raw} onChange={(e) => { setRaw(e.target.checked) }} /> {t('rsi.log.raw')}</label>
            </h3>
            {log.length === 0
              ? <div className={css.dim}>{t('evolve.noLog')}</div>
              : raw
                ? <pre className={css.log}>{log.map(e => JSON.stringify(e)).join('\n')}</pre>
                : log.map((e, i) => (
                  <div key={e.seq ?? i} className={css.logLine}><time>{clock(e.ts)}</time><span>{describeEvent(e, t)}</span></div>
                ))}
          </>
        )}

      <details className={css.strict}>
        <summary>{t('rsi.strict')} <span className={css.dim}>{t('rsi.strictNote')}</span></summary>
        {renderView?.('rsi-strict')}
        <div role="tablist" className={css.pageHead}>
          {STRICT_TABS.map(s => (
            <button key={s.id} type="button" role="tab" aria-selected={s.id === strictTab} onClick={() => { setStrictTab(s.id) }}>
              {t(s.label)}
            </button>
          ))}
        </div>
        {renderView?.(strictTab)}
      </details>
    </div>
  )
}

/** campaign.json's status word as a chip: the three known words get copy,
 * anything else shows verbatim. */
function StatusChip({ status, t }: { status: string | undefined; t: T }) {
  const word = status === 'running' ? t('rsi.status.running') : status === 'done' ? t('rsi.status.done') : status === 'cancelled' ? t('rsi.status.cancelled') : status ?? '—'
  return <span className={css.statusChip} data-status={status ?? ''}>{word}</span>
}

/** 已用时 since the round started, and 预计剩余 from the previous round's wall
 * time (none on the first round). Both are clock arithmetic on the live block,
 * never a projection. */
function Elapsed({ live, now, t }: { live: LiveState; now: number; t: T }) {
  const since = live.round_started_at ?? live.started_at
  const elapsed = typeof since === 'number' ? Math.max(0, Math.floor(now / 1000 - since)) : null
  const last = live.last_round_s
  return (
    <span className={css.dim} data-testid="rsi-elapsed">
      {elapsed !== null && `${t('rsi.elapsed', { t: formatAgo(elapsed) })} · `}
      {typeof last === 'number' && elapsed !== null ? t('rsi.eta', { t: formatAgo(Math.max(0, Math.floor(last - elapsed))) }) : t('rsi.etaNone')}
    </span>
  )
}

/** One chip per seed of the current pass: ✓ / ✗ (first death + failure mode)
 * from `per_seed_partial`, 运行中 for `live.seed`, 排队 for the rest. */
function SeedBoard({ live, seeds, t }: { live: LiveState; seeds: [number, number] | undefined; t: T }) {
  const [lo, hi] = seeds?.length === 2 ? seeds : [1, live.seeds_total ?? 0]
  const done = new Map((live.per_seed_partial ?? []).map(s => [s.seed, s]))
  const chips = []
  for (let seed = lo; seed <= hi; seed++) {
    const s = done.get(seed)
    const state = s?.success === true ? 'pass' : s?.success === false ? 'fail' : seed === live.seed ? 'running' : 'queued'
    const text = state === 'pass' ? '✓'
      : state === 'fail' ? `✗ ${t('rsi.seed.died', { node: s?.first_death ?? '—' })}${s?.failure_mode ? ` (${s.failure_mode})` : ''}`
        : t(state === 'running' ? 'rsi.seed.running' : 'rsi.seed.queued')
    chips.push(<span key={seed} className={css.seedChip} data-state={state}><span className={css.mono}>{seed}</span> {text}</span>)
  }
  return (
    <div>
      <div className={css.paneLabel}>{t('rsi.seedBoard')}</div>
      <div className={css.seedChips}>{chips}</div>
    </div>
  )
}

/** One kept clip or still, served by the board's byte route
 * (`GET /api/board/media/<session>/<relpath>`): a muted metadata-only
 * `<video>` for .mp4, an `<img>` otherwise; the caption is the node name the
 * harness put in the filename (`media/<task>/<seed>/<node>.mp4`). */
function MediaCard({ session, path }: { session: string; path: string }) {
  const src = `/api/board/media/${encodeURIComponent(session)}/${path.split('/').map(encodeURIComponent).join('/')}`
  const node = (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '')
  return (
    <figure className={css.mediaCard} title={path}>
      {path.endsWith('.mp4')
        ? <video src={src} controls muted preload="metadata" />
        : <img src={src} alt={node} loading="lazy" />}
      <figcaption className={css.mono}>{node}</figcaption>
    </figure>
  )
}

/** One round of the loop, in its four teaching beats: 看到了什么 (per_seed) →
 * 试了什么 (tried) → 结果 (before → after, best) → 发布 (published), plus
 * 还缺什么 (needs) when the proposer had nothing to try. */
function RoundCard({ r, t }: { r: CampaignRound; t: T }) {
  const seeds = r.per_seed ?? []
  return (
    <div className={css.card}>
      <div className={css.cardHead}><span className={css.cardHeadTitle}>{t('rsi.roundN', { r: r.round ?? 0 })}</span></div>
      <div className={css.beat}><span className={css.beatLabel}>{t('rsi.saw')}</span><div>
        {seeds.length === 0
          ? <span className={css.dim}>{t('rsi.noPerSeed')}</span>
          : (
            <table className={css.table}>
              <thead><tr><th>{t('rsi.seed')}</th><th>{t('success')}</th><th>{t('rsi.firstDeath')}</th><th>{t('skills.failureModes')}</th></tr></thead>
              <tbody>{seeds.map(s => (
                <tr key={s.seed}><td className={css.mono}>{s.seed}</td><td>{s.success === true ? '✓' : s.success === false ? '✗' : '—'}</td>
                  <td className={css.mono}>{s.first_death ?? '—'}</td><td className={css.mono}>{s.failure_mode ?? '—'}</td></tr>
              ))}</tbody>
            </table>
          )}
      </div></div>
      <div className={css.beat}><span className={css.beatLabel}>{t('rsi.tried')}</span><span>{describeTried(r.tried, t)}</span></div>
      <div className={css.beat}><span className={css.beatLabel}>{t('rsi.result')}</span><span className={css.mono}>{r.before} → {r.after} ({t('evolve.best')} {r.best})</span></div>
      <div className={css.beat}><span className={css.beatLabel}>{t('rsi.published')}</span><span>{r.published === true ? t('yes') : t('no')}</span></div>
      {r.tried?.kind === 'none' && (r.needs ?? []).length > 0 && (
        <div className={css.beat}><span className={css.beatLabel}>{t('rsi.needs')}</span><span>{(r.needs ?? []).join(' · ')}</span></div>
      )}
    </div>
  )
}
