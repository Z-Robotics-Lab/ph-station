/** RSI page: the lightweight evolve loop (look → try → rerun the same seeds →
 * publish when better) as the one RSI surface, kept flat. Head = task input ·
 * 开始/继续 · 停止 · session select; a chip row of the session's campaigns
 * (`rsiCampaigns`, read off disk so it survives a restart; the first row —
 * running, else newest — auto-selects); then the picked campaign: 状态卡 only
 * while a round is in flight (stepper on `live.phase`, seed / node, elapsed /
 * ETA, message, the running seed's node chips), the last `live.messages`
 * lines, the live frame + seed board while running, one 轮次 strip
 * (round chips above the `rsiSeries` chart — one 0–100% axis, 节点通过率 solid /
 * 整任务成功 dotted — and the 按子任务 heat strip; a chip picks the round), the round
 * card (one summary line 节点通过 k/n → k/n · 子任务 ✓/✗, LLM 分析 = `llm.summary`
 * when the round carries one, then 看到了什么 =
 * per-seed table, or the seed × node matrix — 基线 / 试探 side by side, changed
 * cells highlighted — once rows carry `nodes`; 试了什么 with a source chip off
 * `proposer` (LLM / 规则 / 收件箱; the round chips carry the same) and
 * `llm.rationale` beneath / 结果 / 发布 / 还缺什么), 关键片段, and 日志
 * folded unless the campaign failed or was cancelled. The legacy heavy chain
 * (prereg / blind twin / held-out) renders only when legacy stores exist. The
 * head's 提议器 select (LLM by default, else 规则) rides the brief as `proposer`.
 * Renders only — every count is campaign.json's, written by scripts/evolve.py. */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { formatAgo, seedCount, statusLine } from './format.ts'
import { evolveSessions, pickEvolveDefault } from './OperatorRail.tsx'
import { usePolledLoad } from './poll.ts'
import type {
  Campaign, CampaignRound, CampaignSummary, LiveState, NodeRow, RoundRates, RuntimeEvent, RuntimeEventsPayload, SeedRow, SeriesPoint,
  SessionSummary,
} from './types.ts'
import css from './ops.module.css'

/** The board faces this page drives, injected by the slot registration. */
export interface RsiInjected {
  /** POST /api/board/cards: the task picker's names come from `task_bindings`. */
  fetchCards: () => Promise<RemoteResult<unknown>>
  fetchSessions: () => Promise<RemoteResult<unknown>>
  fetchRuntimeEvents: (session: string) => Promise<RemoteResult<unknown>>
  /** POST /api/board/stores: non-empty means the legacy heavy chain has stores to show. */
  fetchStores: () => Promise<RemoteResult<unknown>>
  /** POST /api/board/rsi_campaigns: every campaign the session holds on disk. */
  fetchRsiCampaigns: (session: string) => Promise<RemoteResult<unknown>>
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

/** The four beats of one round, in loop order; `live.phase` names one of them. */
const PHASES = ['baseline', 'propose', 'retest', 'publish'] as const
/** The proposers the head offers: the brief's `proposer` word, LLM first (the default). */
const PROPOSERS = ['llm', 'rules'] as const
/** Poll cadence: seconds while a campaign runs, slower once it settled. */
const POLL_RUNNING_MS = 2000
const POLL_IDLE_MS = 10000

/** The legacy panels the strict section swaps between, by conversation.view id. */
const STRICT_TABS = [
  { id: 'evolution', label: 'rsi.tab.evolution' },
  { id: 'battle', label: 'rsi.tab.battle' },
  { id: 'ledger', label: 'rsi.tab.ledger' },
] as const

/** The brief ids the feed claimed for `task`, read verbatim off the board's own
 * `task_claimed` markers: the log filter. (Which brief is still open comes from
 * `rsiCampaigns`' `open_brief`, read off the intake dirs, not this per-boot feed.) */
function briefsOf(events: RuntimeEvent[], task: string): Set<string> {
  const ids = new Set<string>()
  for (const e of events) if (e.kind === 'task_claimed' && e.task === task && typeof e.brief === 'string') ids.add(e.brief)
  return ids
}

/** Inline SVG line chart of the series on one 0–100% axis. 节点通过率 = the
 * main signal: `node_rate` before / after / best as solid lines (k/n·100 when
 * a row predates node_rate). 整任务成功 = the round's after k/n·100 as one thin
 * dotted line. Two checkboxes hide either group; no chart library. */
export function SeriesChart({ series, n, t }: { series: SeriesPoint[]; n: number; t: T }) {
  const [show, setShow] = useState({ nodes: true, task: true })
  const W = 320; const H = 130; const L = 26; const R = 8; const TOP = 8; const B = 26
  if (series.length === 0) return <div className={css.dim}>{t('rsi.chartEmpty')}</div>
  const x = (i: number) => L + (series.length < 2 ? 0 : (i * (W - L - R)) / (series.length - 1))
  const y = (pct: number) => H - B - (pct / 100) * (H - B - TOP)
  const taskPct = (v: number | null | undefined) => (n > 0 ? ((v ?? 0) / n) * 100 : 0)
  const nodePct = (p: SeriesPoint, k: 'before' | 'after' | 'best') => {
    const r = p.node_rate?.[k]
    return typeof r === 'number' ? r * 100 : taskPct(p[k])
  }
  const line = (k: 'before' | 'after' | 'best') => series.map((p, i) => `${x(i)},${y(nodePct(p, k))}`).join(' ')
  const taskLine = series.map((p, i) => `${x(i)},${y(taskPct(p.after))}`).join(' ')
  const legend: Array<[string, 'before' | 'after' | 'best']> = [[t('evolve.before'), 'before'], [t('evolve.after'), 'after'], [t('evolve.best'), 'best']]
  const cls = { before: css.chartBefore, after: css.chartAfter, best: css.chartBest }
  return (
    <div>
      <div className={css.chartToggles}>
        {(['nodes', 'task'] as const).map(g => (
          <label key={g}><input type="checkbox" data-group={g} checked={show[g]} onChange={(e) => { setShow({ ...show, [g]: e.target.checked }) }} /> {t(`rsi.chart.${g}`)}</label>
        ))}
      </div>
      <svg className={css.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('evolve.chart')}>
        <line className={css.chartAxis} x1={L} y1={TOP} x2={L} y2={H - B} />
        <line className={css.chartAxis} x1={L} y1={H - B} x2={W - R} y2={H - B} />
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line className={css.chartGrid} x1={L} y1={y(v)} x2={W - R} y2={y(v)} />
            <text className={css.chartLabel} x={L - 4} y={y(v) + 3} textAnchor="end" data-axis="y">{v}%</text>
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
        {show.nodes && (['before', 'after', 'best'] as const).map(k => (
          <polyline key={k} className={cls[k]} data-series={k} points={line(k)} />
        ))}
        {show.task && <polyline className={css.chartTask} data-series="task" points={taskLine} />}
      </svg>
    </div>
  )
}

/** 按子任务 heat strip under the chart: rows = tasks in plan (first-seen) order,
 * columns = rounds; a cell is `by_task` after (before when the round tried
 * nothing) coloured red→green, ▲ / ▼ when after moved off before; the tooltip
 * spells "第 r 轮 · nav 通过 1/2". Nothing when no row carries by_task. */
export function TaskHeat({ series, n, t }: { series: SeriesPoint[]; n: number; t: T }) {
  const tasks: string[] = []
  for (const p of series) for (const k of Object.keys(p.by_task ?? {})) if (!tasks.includes(k)) tasks.push(k)
  if (tasks.length === 0) return null
  const roundOf = (p: SeriesPoint, i: number) => p.round ?? i + 1
  return (
    <details open className={css.logBlock} data-testid="rsi-heat">
      <summary>{t('rsi.heat')}</summary>
      <table className={css.heat}>
        <thead><tr><th /> {series.map((p, i) => <th key={roundOf(p, i)}>{roundOf(p, i)}</th>)}</tr></thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task}>
              <th className={css.mono}>{task}</th>
              {series.map((p, i) => {
                const c = p.by_task?.[task]
                const rate = c?.after ?? c?.before ?? null
                const r = roundOf(p, i)
                const [a, b] = [c?.after, c?.before]
                const arrow = typeof a === 'number' && typeof b === 'number' && a !== b ? (a > b ? '▲' : '▼') : ''
                return rate === null
                  ? <td key={r} data-task={task} data-round={r} />
                  : (
                    <td key={r} data-task={task} data-round={r} data-rate={rate} title={t('rsi.heat.cell', { r, task, k: Math.round(rate * n), n })}
                      style={{ background: `color-mix(in srgb, color-mix(in srgb, #16a34a ${Math.round(rate * 100)}%, #dc2626) 55%, transparent)` }}>
                      {arrow}
                    </td>
                  )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

/** "节点通过 7/32 → 7/32 · 子任务 nav ✓ grasp ✓ carry ✓ drop ✗": node counts off
 * the round's per_seed / after_seeds nodes (after = before when nothing was
 * retested; the series row's node_rate as a percentage when rows carry no
 * nodes), subtask verdicts off that row's by_task after (before when absent):
 * ✓ every seed, ✗ none, else the percentage. '' when neither exists. */
export function roundSummary(r: CampaignRound, rates: RoundRates | undefined, t: T): string {
  const count = (rows: SeedRow[]) => {
    let k = 0; let total = 0
    for (const s of rows) for (const nd of s.nodes ?? []) { total++; if (nd.ok === true) k++ }
    return total > 0 ? `${k}/${total}` : null
  }
  const pct = (v: number | null | undefined) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : null)
  const bc = count(r.per_seed ?? [])
  const before = bc ?? pct(rates?.node_rate?.before)
  const after = bc !== null ? (count(r.after_seeds ?? []) ?? bc) : (pct(rates?.node_rate?.after) ?? before)
  const parts: string[] = []
  if (before !== null) parts.push(t('rsi.summary.nodes', { b: before, a: after }))
  const tasks = Object.entries(rates?.by_task ?? {}).map(([task, c]) => {
    const v = c?.after ?? c?.before
    return `${task} ${v === 1 ? '✓' : v === 0 ? '✗' : pct(v) ?? '—'}`
  })
  if (tasks.length > 0) parts.push(`${t('rsi.summary.tasks')} ${tasks.join(' ')}`)
  return parts.join(' · ')
}

/** A tunable as the operator reads it: at most 4 significant digits, so a
 * float step like 0.034999999999999996 prints as 0.035. */
export const fmtNum = (v: number): string => String(Number(v.toPrecision(4)))

/** What one round tried, in operator words: "把 drop-can1 的 reach_tol 0.03 →
 * 0.036" / "drop-can1 换用 pi05 执行器" — the {kind, node, detail} shape
 * scripts/evolve.py writes, shown as a sentence rather than JSON. */
export function describeTried(tried: CampaignRound['tried'], t: T): string {
  const d = (tried?.detail ?? {}) as Record<string, unknown>
  const node = tried?.node ?? '—'
  const s = (v: unknown) => (v === undefined || v === null ? '—' : typeof v === 'number' ? fmtNum(v) : typeof v === 'object' ? JSON.stringify(v) : String(v))
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

/** Who proposed a round's try, as a small chip: LLM / 规则 / 收件箱 off the
 * row's `proposer` word; nothing on rows written before proposers were named. */
function SourceChip({ proposer, t }: { proposer: string | null | undefined; t: T }) {
  if (proposer !== 'llm' && proposer !== 'rules' && proposer !== 'inbox') return null
  return <span className={css.seedChip} data-proposer={proposer}>{t(`rsi.proposer.${proposer}`)}</span>
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
  fetchCards, fetchSessions, fetchRuntimeEvents, fetchStores, fetchRsiCampaigns, fetchRsiRun, fetchRsiSeries, fetchRsiFrames,
  fetchRuntimeFrame, submitBrief, cancelBrief, renderView, t,
}: ConvViewProps & InjectFace<RsiInjected> & PropsLocale<'phops'>) {
  const [taskNames, setTaskNames] = useState<string[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [session, setSession] = useState<string | null>(null)
  const [events, setEvents] = useState<RuntimeEvent[]>([])
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null)
  const [task, setTask] = useState<string | null>(null)
  const [current, setCurrent] = useState<Campaign | null>(null)
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [round, setRound] = useState<number | null>(null)
  const [frames, setFrames] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [proposer, setProposer] = useState<typeof PROPOSERS[number]>(PROPOSERS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The brief 开始 just submitted, until the runtime claims it — with the
   * campaign's cursor / status as they stood at submit, so "claimed" means a
   * change, not the state that was already there. */
  const [pending, setPending] = useState<{ brief: string; task: string; cursor: number; wasRunning: boolean; at: number } | null>(null)
  /** The brief just claimed: one transient line before the status card takes over. */
  const [claimed, setClaimed] = useState<string | null>(null)
  const [online, setOnline] = useState<boolean | null>(null)
  const [hasStores, setHasStores] = useState(false)
  const [strictTab, setStrictTab] = useState<string>(STRICT_TABS[0].id)
  const [raw, setRaw] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [hasFrame, setHasFrame] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const frameTs = useRef(0)

  // The legacy heavy chain's stores exist or not for the life of the page: one read.
  useEffect(() => {
    fetchStores().then((r) => { setHasStores(r.ok && Array.isArray(r.value) && r.value.length > 0) }).catch(() => {})
  }, [fetchStores])

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
      // The list is what the session holds on disk (survives a restart); the
      // per-boot feed only feeds the log.
      const [cs, ev] = await Promise.all([fetchRsiCampaigns(name), fetchRuntimeEvents(name)])
      setCampaigns(cs.ok && Array.isArray(cs.value) ? cs.value as CampaignSummary[] : [])
      setEvents(ev.ok ? ((ev.value as RuntimeEventsPayload | null)?.events ?? []) : [])
      if (task !== null) {
        const [run, sr] = await Promise.all([fetchRsiRun(name, task), fetchRsiSeries(name, task)])
        setCurrent(run.ok && typeof (run.value as Campaign | null)?.task === 'string' ? run.value as Campaign : null)
        if (sr.ok) setSeries(Array.isArray(sr.value) ? sr.value as SeriesPoint[] : [])
      }
    } catch {
      setOnline(false)
    }
  }, [fetchCards, fetchSessions, fetchRsiCampaigns, fetchRuntimeEvents, fetchRsiRun, fetchRsiSeries, session, task])

  const sessionName = session ?? pickEvolveDefault(sessions)
  const sel = campaigns?.find(c => c.task === task) ?? null
  const running = sel?.status === 'running'
  // Auto-select the first row: the board sorts running first, then newest updated.
  useEffect(() => {
    if (task !== null || !campaigns?.length) return
    const c = campaigns[0]
    if (typeof c?.task === 'string') { setTask(c.task); setDraft(c.task) }
  }, [campaigns, task])
  usePolledLoad(load, running || pending !== null ? POLL_RUNNING_MS : POLL_IDLE_MS)
  // A pending brief resolves on the first sign the runtime took it: its
  // task_claimed marker, the campaign turning running, or its cursor moving.
  useEffect(() => {
    if (pending === null) return
    const c = campaigns?.find(x => x.task === pending.task)
    const taken = events.some(e => e.kind === 'task_claimed' && e.brief === pending.brief)
      || (!pending.wasRunning && c?.status === 'running')
      || (typeof c?.cursor === 'number' && c.cursor > pending.cursor)
    if (taken) { setPending(null); setClaimed(pending.brief) }
  }, [campaigns, events, pending])
  useEffect(() => {
    if (pending === null) return
    const timer = setInterval(() => { setNow(Date.now()) }, 1000)
    return () => { clearInterval(timer) }
  }, [pending])
  useEffect(() => {
    if (claimed === null) return
    const timer = setTimeout(() => { setClaimed(null) }, 4000)
    return () => { clearTimeout(timer) }
  }, [claimed])
  const shownCampaign = current?.task === task ? current : null
  const live = inFlight(shownCampaign?.live) ? shownCampaign.live : null
  const rounds = shownCampaign?.rounds ?? []
  const shownRound = round ?? shownCampaign?.latest?.round ?? null
  const shown = rounds.find(r => r.round === shownRound) ?? null

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

  const ids = task === null ? new Set<string>() : briefsOf(events, task)
  const log = events.filter(e => (typeof e.brief === 'string' ? ids.has(e.brief) : e.task === task))
  // Until rsiCampaigns reports open_brief, the brief just submitted is the one to stop.
  const open = sel?.open_brief ?? (pending?.task === task ? pending.brief : null)
  // The log opens itself when the campaign ended badly; otherwise it stays folded.
  const failed = sel?.status === 'cancelled' || sel?.status === 'failed' || log.some(e => e.kind === 'task_failed')

  /** Start or resume: the brief is `{kind:"evolve", task, proposer}` and nothing
   * else; the runtime continues a known task from campaign.json's cursor. */
  const start = useCallback(async () => {
    const tk = draft.trim()
    if (sessionName === null || tk === '') return
    setBusy(true); setError(null)
    try {
      const r = await submitBrief(JSON.stringify({ kind: 'evolve', task: tk, proposer }), sessionName)
      const v = r.ok ? r.value as { submitted?: string; error?: string } | null : null
      if (v?.submitted === undefined) { setError(v?.error ?? t('brain.transportFail')); return }
      const c = campaigns?.find(x => x.task === tk)
      setNow(Date.now())
      setPending({ brief: v.submitted, task: tk, cursor: c?.cursor ?? -1, wasRunning: c?.status === 'running', at: Date.now() })
      setClaimed(null)
      setSession(sessionName)
      setTask(tk); setRound(null)
    } catch {
      setError(t('brain.transportFail'))
    } finally {
      setBusy(false)
    }
  }, [submitBrief, sessionName, draft, proposer, campaigns, t])

  const stop = useCallback(async () => {
    if (sessionName === null || open === null) return
    setBusy(true); setError(null)
    try {
      const r = await cancelBrief(open, sessionName)
      const v = r.ok ? r.value as { error?: string } | null : null
      if (v?.error !== undefined) setError(v.error)
      else if (open === pending?.brief) setPending(null)
    } catch {
      setError(t('brain.transportFail'))
    } finally {
      setBusy(false)
    }
  }, [cancelBrief, sessionName, open, pending, t])

  const pick = (c: CampaignSummary) => { setTask(c.task ?? null); setRound(null); setDraft(c.task ?? '') }

  if (online === false) return <div className={css.state}>{t('unavailable')}</div>
  if (campaigns === null) return <div className={css.state}>{t('loading')}</div>
  const n = sel === null ? 0 : seedCount(sel)
  const liveRound = live?.round ?? (rounds.length + 1)
  const waited = pending === null ? 0 : Math.max(0, Math.floor((now - pending.at) / 1000))
  return (
    <div className={css.page}>
      <div className={css.pageHead}>
        <label>{t('evolve.task')} <input list="ph-rsi-tasks" value={draft} placeholder={t('evolve.taskHint')}
          onChange={(e) => { setDraft(e.target.value) }} /></label>
        <datalist id="ph-rsi-tasks">{taskNames.map(n => <option key={n} value={n} />)}</datalist>
        <label>{t('rsi.proposer')} <select value={proposer} onChange={(e) => { setProposer(e.target.value as typeof PROPOSERS[number]) }}>
          {PROPOSERS.map(p => <option key={p} value={p}>{t(`rsi.proposer.${p}`)}</option>)}
        </select></label>
        <button type="button" disabled={busy || draft.trim() === '' || sessionName === null || pending?.task === draft.trim()} onClick={() => { void start() }}>
          {busy ? t('evolve.starting') : t('evolve.start')}
        </button>
        <button type="button" disabled={busy || open === null} onClick={() => { void stop() }}>{t('evolve.stop')}</button>
        {error !== null && <span className={css.brainError}>{error}</span>}
        <label className={css.headRight}>{t('brain.session')} <select value={sessionName ?? ''} onChange={(e) => { setSession(e.target.value); setTask(null); setCurrent(null) }}>
          {evolveSessions(sessions).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select></label>
      </div>
      {pending !== null && (
        <div className={waited >= 60 ? css.brainError : css.dim} data-testid="rsi-pending">
          {t(waited >= 60 ? 'evolve.unclaimed' : 'evolve.submitted', { brief: pending.brief, s: waited })}
        </div>
      )}
      {pending === null && claimed !== null && <div className={css.dim} data-testid="rsi-pending">{t('evolve.claimed', { brief: claimed })}</div>}

      {campaigns.length > 0 && (
        <div className={css.timeline} data-testid="rsi-campaigns">
          {campaigns.map(c => (
            <button key={c.task} type="button" className={css.tlChip} aria-pressed={c.task === task} onClick={() => { pick(c) }}>
              <b className={css.mono}>{c.task}</b> · {statusLine(c, t)}
            </button>
          ))}
        </div>
      )}

      {sel === null
        ? <div className={css.state}>{t('rsi.guide')}</div>
        : (
          <>
            {(live !== null || running) && (
              <div className={`${css.card} ${css.statusCard}`} data-testid="rsi-status">
                {live !== null
                  ? (
                    <>
                      <div className={css.statusRow}>
                        <span>{t('rsi.roundN', { r: liveRound })}</span>
                        <div className={css.stepper}>
                          {PHASES.map((ph, i) => (
                            <span key={ph}>
                              {i > 0 && <span className={css.stepArrow}> → </span>}
                              <span className={css.step} data-phase={ph} aria-current={live.phase === ph ? 'step' : undefined}>{t(ph === 'propose' && live.phase === 'propose' ? 'rsi.phase.proposing' : `rsi.phase.${ph}`)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={css.statusRow}>
                        <span>{t('rsi.seedLine', { i: live.seed_index ?? 0, n: live.seeds_total ?? n, seed: live.seed ?? '—', node: live.node ?? '—' })}</span>
                        <Elapsed live={live} now={now} t={t} />
                      </div>
                      {typeof live.message === 'string' && live.message !== '' && <div className={css.dim}>{live.message}</div>}
                      {(live.nodes?.length ?? 0) > 0 && <NodeChips nodes={live.nodes ?? []} t={t} />}
                    </>
                  )
                  : <div className={css.dim}>{t('rsi.noLive')}</div>}
              </div>
            )}
            {(live?.messages?.length ?? 0) > 0 && <Messages messages={live?.messages ?? []} running={running} t={t} />}

            {running && (
              <div className={css.liveGrid}>
                <div>
                  <img ref={imgRef} className={css.liveFrame} alt={t('rsi.sec.live')} hidden={!hasFrame} />
                  {!hasFrame && <div className={css.dim}>{t('rsi.noFrame')}</div>}
                </div>
                {live !== null && <SeedBoard live={live} seeds={shownCampaign?.seeds} t={t} />}
              </div>
            )}

            <h3 className={css.secTitle}>{t('evolve.round')} <span className={css.dim}>{t('evolve.chart')}</span></h3>
            <div className={css.roundStrip}>
              <div className={css.timeline} data-testid="rsi-rounds">
                {rounds.map(r => (
                  <button key={r.round} type="button" className={css.tlChip} aria-pressed={r.round === shownRound} onClick={() => { setRound(r.round ?? null) }}>
                    <span><b>{t('rsi.roundN', { r: r.round ?? 0 })}</b> <span className={css.mono}>{r.before} → {r.after}</span> · {r.published === true ? '✓' : '–'}</span>
                    <span className={css.tlTried}><SourceChip proposer={r.proposer} t={t} /> {describeTried(r.tried, t)}</span>
                  </button>
                ))}
                {live !== null && (
                  <button type="button" className={css.tlChip} data-running="true" aria-pressed={liveRound === shownRound} onClick={() => { setRound(liveRound) }}>
                    <span><b>{t('rsi.roundN', { r: liveRound })}</b> · {t(`rsi.phase.${live.phase as typeof PHASES[number]}`)}</span>
                    <span className={css.tlTried}>{live.tried ? describeTried(live.tried, t) : t('rsi.seed.running')}</span>
                  </button>
                )}
              </div>
              <SeriesChart series={series} n={n} t={t} />
              <TaskHeat series={series} n={n} t={t} />
            </div>

            {shown !== null
              ? <RoundCard r={shown} rates={series.find(p => p.round === shown.round)} t={t} />
              : <div className={css.dim}>{t('rsi.roundRunning')}</div>}

            <h3 className={css.secTitle}>{t('rsi.sec.frames')}{shownRound !== null ? ` · ${t('rsi.roundN', { r: shownRound })}` : ''}</h3>
            {frames.length === 0
              ? <div className={css.dim}>{t('evolve.noMedia')}</div>
              : <div className={css.media}>{frames.map(p => <MediaCard key={p} session={sessionName ?? ''} path={p} />)}</div>}
            {Object.entries(shown?.media_dropped ?? {}).map(([k, why]) => (
              <div key={k} className={css.dim}><span className={css.mono}>{k}</span> · {t('rsi.dropped')}: {why}</div>
            ))}

            <details className={css.logBlock} open={failed} data-testid="rsi-log">
              <summary>{t('rsi.sec.log')}</summary>
              <label className={css.dim}><input type="checkbox" checked={raw} onChange={(e) => { setRaw(e.target.checked) }} /> {t('rsi.log.raw')}</label>
              {log.length === 0
                ? <div className={css.dim}>{t('evolve.noLog')}</div>
                : raw
                  ? <pre className={css.log}>{log.map(e => JSON.stringify(e)).join('\n')}</pre>
                  : log.map((e, i) => (
                    <div key={e.seq ?? i} className={css.logLine}><time>{clock(e.ts)}</time><span>{describeEvent(e, t)}</span></div>
                  ))}
            </details>
          </>
        )}

      {hasStores && (
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
      )}
    </div>
  )
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

/** One chip per plan node of the running seed, in plan order: ✓ steps (ok
 * true), ✗ failure_mode (ok false), ● pulsing for the first unrun node, ○ for
 * the rest. Rendered only when `live.nodes` is non-empty. */
function NodeChips({ nodes, t }: { nodes: NodeRow[]; t: T }) {
  let running = true
  return (
    <div>
      <div className={css.paneLabel}>{t('rsi.nodes')}</div>
      <div className={css.nodeChips} data-testid="rsi-nodes">
        {nodes.map((nd, i) => {
          const state = nd.ok === true ? 'pass' : nd.ok === false ? 'fail' : running ? 'running' : 'queued'
          if (state === 'running') running = false
          const mark = { pass: '✓', fail: '✗', running: '●', queued: '○' }[state]
          const small = state === 'pass' && typeof nd.steps === 'number' ? t('rsi.node.steps', { n: nd.steps })
            : state === 'fail' ? nd.failure_mode ?? '' : ''
          return (
            <span key={nd.id ?? i} className={css.seedChip} data-state={state} title={nd.skill ?? undefined}>
              {mark} <span className={css.mono}>{nd.id ?? '—'}</span>{small !== '' && <span className={css.nodeChip}>{small}</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** The last 8 `live.messages` as HH:MM:SS text, newest last and kept scrolled
 * to; only the latest line once the campaign is no longer running. */
function Messages({ messages, running, t }: { messages: NonNullable<LiveState['messages']>; running: boolean; t: T }) {
  const ref = useRef<HTMLDivElement>(null)
  const shown = messages.slice(running ? -8 : -1)
  const lastTs = shown[shown.length - 1]?.ts
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [shown.length, lastTs])
  return (
    <div>
      <div className={css.paneLabel}>{t('rsi.messages')}</div>
      <div ref={ref} className={css.msgs} data-testid="rsi-messages">
        {shown.map((m, i) => <div key={`${m.ts ?? 0}-${i}`} className={css.logLine}><time>{clock(m.ts)}</time><span>{m.text ?? ''}</span></div>)}
      </div>
    </div>
  )
}

/** Node ids across every row, first-seen order (plan order, since each row lists its nodes in order). */
function nodeIds(rows: SeedRow[]): string[] {
  const ids: string[] = []
  for (const r of rows) for (const nd of r.nodes ?? []) if (typeof nd.id === 'string' && !ids.includes(nd.id)) ids.push(nd.id)
  return ids
}

/** Seeds × nodes: ✓ / ✗ / – per cell (steps and failure mode on hover),
 * elapsed_s per row. With `other` (the paired baseline or trial rows), a cell
 * whose `ok` differs there is marked `data-changed`. */
function NodeMatrix({ rows, other, ids, title, t }:
{ rows: SeedRow[]; other?: SeedRow[] | undefined; ids: string[]; title: string; t: T }) {
  const cell = (r: SeedRow, id: string) => r.nodes?.find(nd => nd.id === id)
  return (
    <div>
      <div className={css.paneLabel}>{title}</div>
      <table className={css.table} data-testid={`rsi-matrix-${title}`}>
        <thead><tr><th>{t('rsi.seed')}</th>{ids.map(id => <th key={id} className={css.mono}>{id}</th>)}<th>{t('rsi.matrix.elapsed')}</th></tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.seed}><td className={css.mono}>{r.seed}</td>
            {ids.map((id) => {
              const nd = cell(r, id)
              const ok = nd?.ok ?? null
              const o = other?.find(x => x.seed === r.seed)
              const changed = other !== undefined && ok !== (o === undefined ? null : cell(o, id)?.ok ?? null)
              const hint = [typeof nd?.steps === 'number' ? t('rsi.node.steps', { n: nd.steps }) : '', nd?.failure_mode ?? ''].filter(Boolean).join(' · ')
              return (
                <td key={id} data-ok={ok === true ? 'pass' : ok === false ? 'fail' : undefined} data-changed={changed ? 'true' : undefined} title={hint || undefined}>
                  {ok === true ? '✓' : ok === false ? '✗' : '–'}
                </td>
              )
            })}
            <td className={css.mono}>{typeof r.elapsed_s === 'number' ? formatAgo(Math.floor(r.elapsed_s)) : '—'}</td>
          </tr>
        ))}</tbody>
      </table>
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

/** One round of the loop, in its teaching beats: LLM 分析 (llm.summary, when
 * the row carries one) → 看到了什么 (per_seed) → 试了什么 (tried, its proposer
 * chip, llm.rationale) → 结果 (before → after, best) → 发布 (published), plus
 * 还缺什么 (needs) when the proposer had nothing to try. */
function RoundCard({ r, rates, t }: { r: CampaignRound; rates: RoundRates | undefined; t: T }) {
  const seeds = r.per_seed ?? []
  const after = r.after_seeds ?? []
  const ids = nodeIds([...seeds, ...after])
  const summary = roundSummary(r, rates, t)
  return (
    <div className={css.card}>
      <div className={css.cardHead}><span className={css.cardHeadTitle}>{t('rsi.roundN', { r: r.round ?? 0 })}</span></div>
      {summary !== '' && <div className={css.mono} data-testid="rsi-round-summary">{summary}</div>}
      {r.llm != null && <div className={css.beat} data-testid="rsi-analysis"><span className={css.beatLabel}>{t('rsi.analysis')}</span><span>{r.llm.summary ?? ''}</span></div>}
      <div className={css.beat}><span className={css.beatLabel}>{t('rsi.saw')}</span><div>
        {seeds.length === 0
          ? <span className={css.dim}>{t('rsi.noPerSeed')}</span>
          : ids.length > 0
            ? (
              <div className={css.matrices}>
                <NodeMatrix rows={seeds} other={after.length > 0 ? after : undefined} ids={ids} title={t('rsi.matrix.baseline')} t={t} />
                {after.length > 0 && <NodeMatrix rows={after} other={seeds} ids={ids} title={t('rsi.matrix.trial')} t={t} />}
              </div>
            )
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
      <div className={css.beat}><span className={css.beatLabel}>{t('rsi.tried')}</span><div>
        <SourceChip proposer={r.proposer} t={t} /> {describeTried(r.tried, t)}
        {typeof r.llm?.rationale === 'string' && r.llm.rationale !== '' && <div className={css.dim} data-testid="rsi-rationale">{r.llm.rationale}</div>}
      </div></div>
      <div className={css.beat}><span className={css.beatLabel}>{t('rsi.result')}</span><span className={css.mono}>{r.before} → {r.after} ({t('evolve.best')} {r.best})</span></div>
      <div className={css.beat}><span className={css.beatLabel}>{t('rsi.published')}</span><span>{r.published === true ? t('yes') : t('no')}</span></div>
      {r.tried?.kind === 'none' && (r.needs ?? []).length > 0 && (
        <div className={css.beat}><span className={css.beatLabel}>{t('rsi.needs')}</span><span>{(r.needs ?? []).join(' · ')}</span></div>
      )}
    </div>
  )
}
