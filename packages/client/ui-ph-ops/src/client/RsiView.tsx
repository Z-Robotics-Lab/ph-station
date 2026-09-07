/** RSI campaign controls and evidence. The round chart renders fixed-objective
 * progress when the backend supplies evaluation; historical node pass rates
 * remain diagnostic. Development acceptance and verified installation are
 * separate recorded decisions. Per-round details, media, operational logs,
 * live frames, seed progress, and round navigation keep their existing
 * board reads. Full evidence is fetched only for the selected round. */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { formatAgo, seedCount, statusLine } from './format.ts'
import { evolveSessions, pickEvolveDefault } from './OperatorRail.tsx'
import { usePolledLoad } from './poll.ts'
import { RsiEvidence, RsiTransfer } from './RsiEvidence.tsx'
import { RsiLearning } from './RsiLearning.tsx'
import type {
  Campaign, CampaignRound, CampaignSummary, FramesPayload, LiveState, NodeRow, RoundRates, RuntimeEvent, RuntimeEventsPayload, SeedRow,
  RsiModelOptions, RunBudget, SeriesPoint, SessionSummary, Usage,
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
  /** POST /api/board/rsiModelOptions: provider discovery and request defaults. */
  fetchRsiModelOptions: () => Promise<RemoteResult<unknown>>
  /** POST /api/board/rsi_campaigns: every campaign the session holds on disk. */
  fetchRsiCampaigns: (session: string) => Promise<RemoteResult<unknown>>
  /** POST /api/board/rsi_run: the header + latest + live + the last 20 compact
   * rounds, or null when none. `round` (> 0) asks for that ONE round in FULL
   * (per-seed trails, trial_evidence, llm, media) as a single-element `rounds`. */
  fetchRsiRun: (session: string, task: string, round?: number) => Promise<RemoteResult<unknown>>
  /** POST /api/board/rsi_series: one compact row per round (never per-seed trails). */
  fetchRsiSeries: (session: string, task: string) => Promise<RemoteResult<unknown>>
  /** POST /api/board/rsi_frames: kept media paths of one round, plus the keyframes of its dropped nodes. */
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
interface ScopedRead<T> { key: string; value: T }
interface RoundMedia { media: string[]; keyframes: Record<string, string[]> }

/** Development evaluation phases, including the optional additional seed pass. */
const PHASES = ['baseline', 'propose', 'retest', 'confirm', 'publish'] as const
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
    <details className={css.disclosure} data-testid="rsi-heat">
      <summary>{t('rsi.heat')}</summary>
      <div className={css.heatViewport}>
        <table className={css.heat}>
          <thead><tr><th /> {series.map((p, i) => <th key={roundOf(p, i)}>{roundOf(p, i)}</th>)}</tr></thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task}>
                <th scope="row" title={task}>{task}</th>
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
      </div>
    </details>
  )
}

/** Format backend node diagnostics and per-task rates without folding plan nodes.
 * @param rates - The selected round's board-computed diagnostic rates.
 * @param t - Localized labels.
 * @returns A diagnostic summary, or an empty string when no rates were reported.
 */
export function roundSummary(rates: RoundRates | undefined, t: T): string {
  const pct = (v: number | null | undefined) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : null)
  const before = pct(rates?.node_rate?.before)
  const after = pct(rates?.node_rate?.after) ?? '—'
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
    case 'plan': out = t('rsi.tried.plan'); break
    case 'card': out = t('rsi.tried.card', { node, to: s(d.to) }); break
    case 'none': out = t('rsi.tried.none', { reason: s(d.reason) }); break
    default: out = `${tried?.kind ?? '—'} @ ${node}`
  }
  return typeof d.error === 'string' ? `${out} · ${d.error}` : out
}

const fmtTokens = (n: number): string => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

/** "LLM tokens 97.3k (cache 91%) · 仿真 164 s" off a round's (or the campaign's summed)
 * usage. When the endpoint reports prefix-cache hits, tokens = the BILLABLE count
 * (uncached prompt + completion) with the cached share beside it; otherwise
 * prompt + completion. '—' when the round called no LLM. */
export function usageLine(u: Usage, t: T): string {
  const tk = u.llm_tokens
  if (tk == null) return t('rsi.usage', { tokens: '—', s: Math.round(u.sim_s ?? 0) })
  const prompt = tk.prompt ?? 0
  const total = prompt + (tk.completion ?? 0)
  const cached = tk.cache_hit ?? 0
  const tokens = cached > 0 && prompt > 0
    ? `${fmtTokens(total - cached)} (cache ${Math.round(100 * cached / prompt)}%)`
    : fmtTokens(total)
  return t('rsi.usage', { tokens, s: Math.round(u.sim_s ?? 0) })
}

/** "确认种子 4247,4248 · 0/2 → 1/2 · 通过": the historical development pass; the
 * verdict is the round's own publish decision, not a re-derivation. */
export function confirmLine(r: CampaignRound, t: T): string {
  const seeds = r.confirm?.seeds ?? []
  return t('rsi.confirm.line', { seeds: seeds.join(','), b: r.confirm?.before ?? 0, a: r.confirm?.after ?? 0, n: seeds.length, verdict: t(r.published === true ? 'rsi.confirm.pass' : 'rsi.confirm.fail') })
}

/** Recorded authorship; rules is explicitly historical, never a launch option. */
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

/** Unwrap one board call, recording `<call>: <why>` in `bad` when it failed.
 * A face that dies (an oversized body, a missing venv, a raised storecli error)
 * must say so on the page: the operator once watched 490 rounds behind an empty
 * chart because rsi_series outgrew the bridge's buffer and nothing said a word. */
function take<T>(call: string, r: RemoteResult<unknown>, bad: string[]): T | null {
  if (r.ok) return r.value as T
  bad.push(`${call}: ${r.error.message}`)
  return null
}

/** True while `live` describes an evaluation phase in flight. */
const inFlight = (live: LiveState | null | undefined): live is LiveState =>
  live != null && (PHASES as readonly string[]).includes(live.phase ?? '')

export function RsiView({
  fetchCards, fetchSessions, fetchRuntimeEvents, fetchStores, fetchRsiModelOptions, fetchRsiCampaigns,
  fetchRsiRun, fetchRsiSeries, fetchRsiFrames, fetchRuntimeFrame, submitBrief, cancelBrief, renderView, t,
}: ConvViewProps & InjectFace<RsiInjected> & PropsLocale<'phops'>) {
  const [taskNames, setTaskNames] = useState<string[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [session, setSession] = useState<string | null>(null)
  const [sessionRead, setSessionRead] = useState<{ session: string; campaigns: CampaignSummary[]; events: RuntimeEvent[] } | null>(null)
  const [task, setTask] = useState<string | null>(null)
  const [campaignRead, setCampaignRead] = useState<ScopedRead<{ campaign: Campaign | null; series: SeriesPoint[] }> | null>(null)
  const [round, setRound] = useState<number | null>(null)
  /** The selected round in FULL (trails, trial_evidence), fetched one at a time. */
  const [fullRead, setFullRead] = useState<ScopedRead<CampaignRound | null> | null>(null)
  /** `<call>: <why>` for every board face that failed on the last poll. */
  const [faceError, setFaceError] = useState<string | null>(null)
  const [mediaRead, setMediaRead] = useState<ScopedRead<RoundMedia> | null>(null)
  const [tab, setTab] = useState<'run' | 'models'>('run')
  // Empty draft fields delegate defaults to the runtime; discovery never changes them.
  const [model, setModel] = useState('')
  const [effort, setEffort] = useState('')
  const [modelOptions, setModelOptions] = useState<RsiModelOptions | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)
  const [modelLoading, setModelLoading] = useState(true)
  const [modelRefresh, setModelRefresh] = useState(0)
  const [draft, setDraft] = useState('')
  const [continuous, setContinuous] = useState(true)
  const [cycleLimit, setCycleLimit] = useState('1')
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
  /** A loader belongs to one session/task selection, including revisits to the same task. */
  const loadOwner = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    let alive = true
    setModelLoading(true)
    setModelError(null)
    fetchRsiModelOptions().then((r) => {
      if (!alive) return
      if (!r.ok) { setModelError(r.error.message); return }
      const options = r.value as RsiModelOptions | null
      if (options != null && Array.isArray(options.models) && Array.isArray(options.efforts)) setModelOptions(options)
      setModelError(options?.error ?? null)
    }).catch((e: unknown) => { if (alive) setModelError(String(e)) })
      .finally(() => { if (alive) setModelLoading(false) })
    return () => { alive = false }
  }, [fetchRsiModelOptions, modelRefresh])

  // The legacy heavy chain's stores exist or not for the life of the page: one read.
  useEffect(() => {
    fetchStores().then((r) => { setHasStores(r.ok && Array.isArray(r.value) && r.value.length > 0) }).catch(() => {})
  }, [fetchStores])

  const load = useCallback(async () => {
    const bad: string[] = []
    try {
      const [c, s] = await Promise.all([fetchCards(), fetchSessions()])
      if (loadOwner.current !== load) return
      const cards = take<Card[]>('cards', c, bad)
      if (cards !== null) {
        const names = new Set<string>()
        for (const card of cards) for (const tk of card.contributes?.task_bindings ?? []) names.add(tk)
        setTaskNames([...names].sort())
      }
      const list = take<SessionSummary[]>('sessions', s, bad)
      if (list === null) { setOnline(false); setFaceError(bad.join(' · ')); return }
      setOnline(true)
      setSessions(list)
      const name = session ?? pickEvolveDefault(list)
      if (name === null) { setSessionRead(null); setFaceError(bad.length > 0 ? bad.join(' · ') : null); return }
      // The list is what the session holds on disk (survives a restart); the
      // per-boot feed only feeds the log.
      const [cs, ev] = await Promise.all([fetchRsiCampaigns(name), fetchRuntimeEvents(name)])
      if (loadOwner.current !== load) return
      const list2 = take<CampaignSummary[]>('rsi_campaigns', cs, bad)
      setSessionRead({ session: name, campaigns: Array.isArray(list2) ? list2 : [],
        events: take<RuntimeEventsPayload | null>('runtime_events', ev, bad)?.events ?? [] })
      if (task !== null) {
        const [run, sr] = await Promise.all([fetchRsiRun(name, task), fetchRsiSeries(name, task)])
        if (loadOwner.current !== load) return
        const camp = take<Campaign | null>('rsi_run', run, bad)
        const rows = take<SeriesPoint[]>('rsi_series', sr, bad)
        const key = JSON.stringify([name, task])
        setCampaignRead(previous => ({ key, value: {
          campaign: typeof camp?.task === 'string' ? camp : null,
          series: rows !== null ? (Array.isArray(rows) ? rows : []) : previous?.key === key ? previous.value.series : [],
        } }))
      }
      setFaceError(bad.length > 0 ? bad.join(' · ') : null)
    } catch (e) {
      if (loadOwner.current !== load) return
      setOnline(false)
      setFaceError([...bad, `board: ${String(e)}`].join(' · '))
    }
  }, [fetchCards, fetchSessions, fetchRsiCampaigns, fetchRuntimeEvents, fetchRsiRun, fetchRsiSeries, session, task])
  useEffect(() => {
    loadOwner.current = load
    return () => { loadOwner.current = null }
  }, [load])

  const sessionName = session ?? pickEvolveDefault(sessions)
  const campaigns = sessionRead?.session === sessionName ? sessionRead.campaigns : sessionName === null && online ? [] : null
  const events = sessionRead?.session === sessionName ? sessionRead.events : []
  const taskKey = JSON.stringify([sessionName, task])
  const selectedRead = campaignRead?.key === taskKey ? campaignRead.value : null
  const current = selectedRead?.campaign ?? null
  const series = selectedRead?.series ?? []
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
  // The BOUNDED tail rsi_run carries: compact rows, enough for the tree.
  const rounds = shownCampaign?.rounds ?? []
  const shownRound = round ?? shownCampaign?.latest?.round ?? null
  const roundSealed = series.some(r => r.round === shownRound)
  const roundKey = JSON.stringify([sessionName, task, shownRound])
  const full = fullRead?.key === roundKey ? fullRead.value : null
  const frames = mediaRead?.key === roundKey ? mediaRead.value : { media: [], keyframes: {} }
  // The round card wants trails and evidence, which only the single-round read
  // carries; the compact tail row stands in until that lands.
  const shown = (full?.round === shownRound ? full : rounds.find(r => r.round === shownRound)) ?? null

  // A live selection is reread once its sealed row appears in the existing poll.
  useEffect(() => {
    if (sessionName === null || task === null || shownRound === null) return
    let alive = true
    fetchRsiRun(sessionName, task, shownRound)
      .then((r) => {
        if (!alive) return
        if (!r.ok) { setFaceError(`rsi_run(round=${shownRound}): ${r.error.message}`); return }
        setFullRead({ key: roundKey, value: (r.value as Campaign | null)?.rounds?.[0] ?? null })
      })
      .catch(() => { if (alive) setFullRead({ key: roundKey, value: null }) })
    return () => { alive = false }
  }, [fetchRsiRun, sessionName, task, shownRound, roundKey, roundSealed])

  useEffect(() => {
    if (sessionName === null || task === null || shownRound === null) return
    let alive = true
    fetchRsiFrames(sessionName, task, shownRound)
      .then((r) => {
        if (!alive || !r.ok) return
        const v = r.value as FramesPayload
        setMediaRead({ key: roundKey, value: Array.isArray(v)
          ? { media: v, keyframes: {} }
          : {
            media: v?.media ?? [],
            keyframes: Object.fromEntries(Object.entries(v?.dropped ?? {}).map(([k, d]) => [k, d?.keyframes ?? []])),
          } })
      })
      .catch(() => { if (alive) setMediaRead({ key: roundKey, value: { media: [], keyframes: {} } }) })
    return () => { alive = false }
  }, [fetchRsiFrames, sessionName, task, shownRound, roundKey, roundSealed])

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

  const validCycleLimit = Number.isSafeInteger(Number(cycleLimit)) && Number(cycleLimit) > 0
  /** Continuous mode renews the bounded cycle; finite mode caps completed cycles. */
  const start = useCallback(async () => {
    const tk = draft.trim()
    if (sessionName === null || tk === '' || (!continuous && !validCycleLimit)) return
    setBusy(true); setError(null)
    try {
      const r = await submitBrief(JSON.stringify({ kind: 'evolve', task: tk, proposer: 'llm', continuous, rounds: continuous ? 0 : Number(cycleLimit),
        ...(model.trim() === '' ? {} : { llm_model: model.trim() }),
        ...(effort === '' ? {} : { llm_effort: effort }),
      }), sessionName)
      if (!r.ok) { setError(r.error.message); return }
      const v = r.value as { submitted?: string; error?: string } | null
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
  }, [submitBrief, sessionName, draft, model, effort, campaigns, continuous, cycleLimit, validCycleLimit, t])

  const stop = useCallback(async () => {
    if (sessionName === null || open === null) return
    setBusy(true); setError(null)
    try {
      const r = await cancelBrief(open, sessionName)
      if (!r.ok) { setError(r.error.message); return }
      const v = r.value as { error?: string } | null
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
  const liveRound = live?.round ?? (series.length + 1)   // series is every round; `rounds` is a 20-row tail
  const waited = pending === null ? 0 : Math.max(0, Math.floor((now - pending.at) / 1000))
  return (
    <div className={css.page}>
      <div role="tablist" aria-label={t('rsi.tabs')} className={css.pageHead}>
        {(['run', 'models'] as const).map(id => <button key={id} type="button" role="tab"
          id={`rsi-tab-${id}`} aria-controls={`rsi-panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
          onKeyDown={(e) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
            e.preventDefault()
            const next = e.key === 'Home' ? 'run' : e.key === 'End' ? 'models' : tab === 'run' ? 'models' : 'run'
            setTab(next)
            e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#rsi-tab-${next}`)?.focus()
          }}
          onClick={() => { setTab(id) }}>{t(id === 'run' ? 'rsi.tab.run' : 'rsi.tab.models')}</button>)}
      </div>
      {tab === 'models' && <section role="tabpanel" id="rsi-panel-models" aria-labelledby="rsi-tab-models" className={css.rsiPanel}>
        <div className={css.card}>
          <h3>{t('rsi.models.next')}</h3>
          <p className={css.dim}>{t('rsi.models.help')}</p>
          <div className={css.pageHead}>
            <label>{t('rsi.models.model')} <input list="ph-rsi-models" value={model}
              placeholder={t('rsi.models.defaultModel', { model: modelOptions?.default_model ?? t('rsi.models.providerDefault') })}
              onChange={(e) => { setModel(e.target.value) }} /></label>
            <datalist id="ph-rsi-models">{modelOptions?.models.map(m => <option key={m.id} value={m.id} />)}</datalist>
            <label>{t('rsi.models.effort')} <select value={effort} onChange={(e) => { setEffort(e.target.value) }}>
              <option value="">{t('rsi.models.defaultEffort', { effort: modelOptions?.default_effort ?? 'off' })}</option>
              {modelOptions?.efforts.map(value => <option key={value} value={value}>{value}</option>)}
              {effort !== '' && !modelOptions?.efforts.includes(effort) && <option value={effort}>{effort}</option>}
            </select></label>
            <button type="button" disabled={modelLoading} onClick={() => { setModelRefresh(value => value + 1) }}>{t('rsi.models.refresh')}</button>
          </div>
          <p className={css.dim}>{t('rsi.models.manual')}</p>
          {modelLoading && <div role="status">{t('loading')}</div>}
          {modelError !== null && <div className={css.brainError} role="alert">{t('rsi.models.error', { error: modelError })}</div>}
          <p data-testid="rsi-model-draft">{t('rsi.models.selection', {
            model: model.trim() || t('rsi.models.defaultModel', { model: modelOptions?.default_model ?? t('rsi.models.providerDefault') }),
            effort: effort || t('rsi.models.defaultEffort', { effort: modelOptions?.default_effort ?? 'off' }),
          })}</p>
        </div>
        <div className={css.card} data-testid="rsi-model-recorded">
          <h3>{t('rsi.models.recorded')}</h3>
          <div>{task ?? '—'}</div>
          <p>{shownCampaign?.llm_config == null ? t('rsi.models.unrecorded') : t('rsi.models.selection', {
            model: shownCampaign.llm_config.model ?? t('rsi.models.providerDefault'), effort: shownCampaign.llm_config.effort,
          })}</p>
        </div>
      </section>}
      <div role="tabpanel" id="rsi-panel-run" aria-labelledby="rsi-tab-run" hidden={tab !== 'run'} className={css.rsiPanel}>
        <div className={css.pageHead}>
          <label>{t('evolve.task')} <input list="ph-rsi-tasks" value={draft} placeholder={t('evolve.taskHint')}
            onChange={(e) => { setDraft(e.target.value) }} /></label>
          <datalist id="ph-rsi-tasks">{taskNames.map(n => <option key={n} value={n} />)}</datalist>
          <span className={css.dim} data-testid="rsi-proposer-policy">{t('rsi.llmOnly')}</span>
          <label>{t('evolve.mode')} <select value={continuous ? 'continuous' : 'finite'} onChange={(e) => { setContinuous(e.target.value === 'continuous') }}>
            <option value="continuous">{t('evolve.continuous')}</option><option value="finite">{t('evolve.finite')}</option>
          </select></label>
          {!continuous && <label>{t('evolve.cycleLimit')} <input type="number" min="1" step="1" value={cycleLimit} onChange={(e) => { setCycleLimit(e.target.value) }} /></label>}
          <button type="button" disabled={busy || draft.trim() === '' || sessionName === null || pending?.task === draft.trim() || (!continuous && !validCycleLimit) || campaigns.some(c => c.task === draft.trim() && c.open_brief != null)} onClick={() => { void start() }}>
            {busy ? t('evolve.starting') : t('evolve.start')}
          </button>
          <button type="button" disabled={busy || open === null} onClick={() => { void stop() }}>{t('evolve.stop')}</button>
          {error !== null && <span className={css.brainError}>{error}</span>}
          <label className={css.headRight}>{t('brain.session')} <select value={sessionName ?? ''} onChange={(e) => { setSession(e.target.value); setTask(null); setRound(null) }}>
            {evolveSessions(sessions).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select></label>
        </div>
        <div className={css.dim} data-testid="rsi-mode-help">{t(continuous ? 'evolve.continuousHelp' : 'evolve.finiteHelp')}</div>
        {pending !== null && (
          <div className={waited >= 60 ? css.brainError : css.dim} data-testid="rsi-pending">
            {t(waited >= 60 ? 'evolve.unclaimed' : 'evolve.submitted', { brief: pending.brief, s: waited })}
          </div>
        )}
        {pending === null && claimed !== null && <div className={css.dim} data-testid="rsi-pending">{t('evolve.claimed', { brief: claimed })}</div>}
        {faceError !== null && (
          <div className={css.brainError} data-testid="rsi-face-error">{t('rsi.faceError', { calls: faceError })}</div>
        )}

        {campaigns.length > 0 && (
          <div className={css.timeline} data-testid="rsi-campaigns">
            {campaigns.map(c => (
              <button key={c.task} type="button" className={css.tlChip} aria-pressed={c.task === task} onClick={() => { pick(c) }}>
                <b className={css.mono}>{c.task}</b> · {statusLine(c, t)}{c.usage != null && ` · ${usageLine(c.usage, t)}`}
              </button>
            ))}
          </div>
        )}

        {sel === null
          ? <div className={css.state}>{t('rsi.guide')}</div>
          : selectedRead === null ? <div className={css.state} data-testid="rsi-loading">{t('loading')}</div>
            : (
              <>
                {(shownCampaign?.continuous !== undefined || shownCampaign?.stop_reason != null) && <div className={css.dim} data-testid="rsi-run-state">
                  {shownCampaign.continuous === undefined ? '—' : t(shownCampaign.continuous ? 'evolve.continuous' : 'evolve.finite')}
                  {' · '}{t('rsi.cycle.current', { cycle: shownCampaign.cycle_budget?.cycle ?? shownCampaign.live?.cycle ?? '—' })}
                  {running && ` · ${t('rsi.run.running')}`}
                  {shownCampaign.stop_reason != null && ` · ${t('rsi.run.stop', { reason: shownCampaign.stop_reason })}`}
                </div>}
                {(sel.status === 'failed' || shownCampaign?.live?.phase === 'failed') && <div className={css.brainError} role="alert" data-testid="rsi-failure">
                  {t('rsi.failed')}{shownCampaign?.live?.message ? ` · ${shownCampaign.live.message}` : ''}
                </div>}
                {(live !== null || running) && (
                  <div className={`${css.card} ${css.statusCard}`} data-testid="rsi-status">
                    {shownCampaign?.live?.phase === 'backoff' && <div data-testid="rsi-cycle-backoff">
                      {t('rsi.cycle.continuing', { seconds: shownCampaign.live.retry_at == null ? '—' : Math.max(0, Math.ceil(shownCampaign.live.retry_at - now / 1000)) })}
                      {shownCampaign.live.message && <div>{shownCampaign.live.message}</div>}
                    </div>}
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
                      : shownCampaign?.live?.phase !== 'backoff' && <div className={css.dim}>{t('rsi.noLive')}</div>}
                    {shownCampaign?.cycle_budget != null && <BudgetReadout budget={shownCampaign.cycle_budget} id="rsi-live-cycle-budget" t={t} />}
                    {shownCampaign?.run_budget != null && <BudgetReadout budget={shownCampaign.run_budget} id="rsi-live-run-budget" t={t} />}
                  </div>
                )}
                {(live?.messages?.length ?? 0) > 0 && <Messages messages={live?.messages ?? []} running={running} t={t} />}
                {shownCampaign?.transfer != null && shown?.transfer == null && <RsiTransfer transfer={shownCampaign.transfer} t={t} />}

                <div className={css.workspaceGrid} data-testid="rsi-dashboard">
                  <section className={css.visualColumn} data-testid="rsi-live-panel">
                    {running && (
                      <div className={css.liveGrid}>
                        <div>
                          <img ref={imgRef} className={css.liveFrame} alt={t('rsi.sec.live')} hidden={!hasFrame} />
                          {!hasFrame && <div className={css.dim}>{t('rsi.noFrame')}</div>}
                        </div>
                        {live !== null && <SeedBoard live={live} seeds={shownCampaign?.seeds} t={t} />}
                      </div>
                    )}
                    <h3 className={css.secTitle}>{t('rsi.sec.frames')}{shownRound !== null ? ` · ${t('rsi.roundN', { r: shownRound })}` : ''}</h3>
                    {frames.media.length === 0
                      ? <div className={css.dim}>{t('evolve.noMedia')}</div>
                      : <MediaGallery key={`${sessionName}:${task}:${shownRound}`} session={sessionName ?? ''} paths={frames.media} />}
                    {Object.entries(shown?.media_dropped ?? {}).map(([k, why]) => (
                      <div key={k} className={css.droppedRow} data-testid="rsi-dropped" data-node={k}>
                        <span className={css.dim}><span className={css.mono}>{k}</span> · {t('rsi.dropped')}: {typeof why === 'string' ? why : why?.reason ?? ''}</span>
                        {(frames.keyframes[k] ?? []).slice(0, 3).map(p => <img key={p} className={css.keyframe} src={mediaUrl(sessionName ?? '', p)} alt={k} title={p} loading="lazy" />)}
                      </div>
                    ))}
                  </section>
                  <section className={css.evidenceColumn} data-testid="rsi-analysis-panel">
                    <h3 className={css.secTitle}>{t('rsi.learning.chart')}</h3>
                    <div className={css.roundStrip}>
                      <RsiLearning key={taskKey} series={series} selectedRound={shownRound} onPick={setRound}
                        following={round === null} onFollow={() => { setRound(null) }}
                        liveRound={live === null ? null : liveRound} formatCost={usage => usageLine(usage, t)} t={t} />
                      <TaskHeat series={series} n={n} t={t} />
                    </div>

                    {shown !== null
                      ? <RoundCard r={shown} rates={series.find(p => p.round === shown.round)} t={t} />
                      : <div className={css.dim}>{t('rsi.roundRunning')}</div>}
                  </section>
                </div>

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
  // Confirmation uses a different seed suite. Its unreported seed IDs cannot
  // be recovered from the campaign's original development seed range.
  const seedIds = live.phase === 'confirm'
    ? [...new Set([...done.keys(), live.seed].filter((seed): seed is number => typeof seed === 'number'))]
    : Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i)
  const chips = []
  for (const seed of seedIds) {
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
      <div className={css.seedChips} data-testid="rsi-seed-board">{chips}</div>
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

/** Board-owned media paths, encoded one segment at a time. */
const mediaUrl = (session: string, path: string) => `/api/board/media/${encodeURIComponent(session)}/${path.split('/').map(encodeURIComponent).join('/')}`

function MediaGallery({ session, paths }: { session: string; paths: string[] }) {
  const [selection, setSelection] = useState<string | null>(null)
  const path = selection !== null && paths.includes(selection) ? selection : paths[0]
  if (path === undefined) return null
  const label = (p: string) => (p.split('/').pop() ?? p).replace(/\.[^.]+$/, '')
  const context = (p: string) => p.split('/').slice(-4, -1).join(' / ')
  const src = mediaUrl(session, path)
  return (
    <div className={css.mediaGallery} data-testid="rsi-media-gallery">
      <figure className={css.mediaCard} title={path}>
        {path.endsWith('.mp4')
          ? <video key={src} src={src} controls muted preload="metadata" />
          : <img key={src} src={src} alt={label(path)} />}
        <figcaption>
          <span><b>{label(path)}</b><small>{context(path)}</small></span>
          <span className={css.count}>{paths.indexOf(path) + 1} / {paths.length}</span>
        </figcaption>
      </figure>
      <div className={css.clipList}>
        {paths.map((p, i) => <button key={p} type="button" aria-label={p} aria-pressed={p === path}
          title={p} className={css.clipButton} onClick={() => { setSelection(p) }}>
          <span className={css.clipIndex}>{String(i + 1).padStart(2, '0')}</span>
          <span className={css.clipLabel}><b>{label(p)}</b><small>{context(p)}</small></span>
        </button>)}
      </div>
    </div>
  )
}

/** Recorded cycle limits stay distinct from cumulative brief consumption. */
function BudgetReadout({ budget, id, t }: { budget: RunBudget; id: string; t: T }) {
  const measured = (v: number | null | undefined) => v ?? '—'
  const limit = (v: number | null | undefined) => v === null && budget.scope === 'submitted_brief' ? t('rsi.budget.unlimited') : measured(v)
  return <div data-testid={id}>
    <div>{budget.scope === 'learning_cycle' ? t('rsi.budget.cycle', { cycle: budget.cycle ?? '—' }) : budget.scope === 'submitted_brief' ? t('rsi.budget.brief') : t('rsi.budget.scope', { scope: budget.scope ?? '—' })}</div>
    <div>{t('rsi.budget.used', { calls: measured(budget.used?.model_calls), callsLimit: limit(budget.limits?.model_calls), bytes: measured(budget.used?.input_bytes), bytesLimit: limit(budget.limits?.input_bytes), probes: measured(budget.used?.probe_episodes), probesLimit: limit(budget.limits?.probe_episodes) })}</div>
    <div>{t('rsi.budget.evaluations', { full: measured(budget.used?.full_evaluations), output: measured(budget.limits?.output_tokens_per_call) })}</div>
  </div>
}

function RoundCard({ r, rates, t }: { r: CampaignRound; rates: RoundRates | undefined; t: T }) {
  const seeds = r.per_seed ?? []
  const after = r.after_seeds ?? []
  const ids = nodeIds([...seeds, ...after])
  const summary = roundSummary(rates, t)
  const budget = r.llm?.budget
  const abstentionLabel = r.llm?.stop_reason === 'budget_exhausted' ? 'rsi.llm.budgetExhausted'
    : r.llm?.stop_reason === 'model_stop' ? 'rsi.llm.abstained' : 'rsi.llm.noCandidate'
  const measured = (v: number | null | undefined) => v ?? '—'
  return (
    <div className={css.roundDetail}>
      <h3 className={css.secTitle}>{t('rsi.roundN', { r: r.round ?? 0 })}</h3>
      <RsiEvidence round={r} t={t} />
      {r.cycle_outcome != null && <div className={css.dim} data-testid="rsi-cycle-outcome">{t('rsi.cycle.outcome', { cycle: r.cycle_budget?.cycle ?? '—', outcome: r.cycle_outcome })}{r.stop_reason != null && ` · ${t('rsi.cycle.stop', { reason: r.stop_reason })}`}</div>}
      {r.llm != null && Object.keys(r.llm).length > 0 && <div className={css.beat} data-testid="rsi-llm-audit">
        <span className={css.beatLabel}>{t('rsi.llm.audit')}</span>
        <div>
          {r.llm.method != null && <div>{r.llm.method === 'online_program_policy_v1' ? t('rsi.policy.program') : r.llm.method}</div>}
          {r.llm.status != null && <div data-testid="rsi-llm-status" role={r.llm.status === 'error' ? 'alert' : undefined}>
            {r.llm.status === 'proposed' ? t('rsi.llm.proposed') : r.llm.status === 'abstained' ? t(abstentionLabel) : r.llm.status === 'rejected' ? t('rsi.llm.rejected') : r.llm.status === 'error' ? t('rsi.llm.error') : r.llm.status}
          </div>}
          {(r.llm.requested_model != null || r.llm.effort != null) && <div data-testid="rsi-llm-request">{t('rsi.models.request', { model: r.llm.requested_model ?? t('rsi.models.providerDefault'), effort: r.llm.effort ?? '—' })}</div>}
          {(r.llm.model != null || r.llm.prompt_sha != null) && <div className={css.mono}>{t('rsi.llm.identity', { model: r.llm.model ?? '—', prompt: r.llm.prompt_sha ?? '—' })}</div>}
          {(r.llm.evidence_reads !== undefined || r.llm.trial_calls !== undefined || budget != null) && <div data-testid="rsi-llm-counts">
            {t('rsi.llm.counts', { calls: measured(budget?.used?.calls ?? r.llm.calls), limit: measured(budget?.limits?.max_calls), reads: measured(r.llm.evidence_reads), trials: measured(r.llm.trial_calls) })}
          </div>}
          {budget != null && <div data-testid="rsi-llm-budget">
            <div>{t('rsi.llm.bytes', { used: measured(budget.used?.input_bytes), total: measured(budget.limits?.max_input_bytes), request: measured(budget.limits?.max_request_bytes), toolUsed: measured(budget.used?.tool_bytes), tool: measured(budget.limits?.max_tool_bytes) })}</div>
            <div>{t('rsi.llm.output', { used: measured(budget.used?.output_tokens), limit: measured(budget.limits?.max_output_tokens) })}</div>
            {budget.limits?.max_read_calls != null && <div data-testid="rsi-llm-read-limit">{t('rsi.llm.readLimit', { limit: budget.limits.max_read_calls })}</div>}
            {(r.llm.usage_complete === false || budget.usage_complete === false) && <div>{t('rsi.llm.incompleteUsage')}</div>}
          </div>}
          {r.cycle_budget != null && <BudgetReadout budget={r.cycle_budget} id="rsi-cycle-budget" t={t} />}
          {r.run_budget != null && <BudgetReadout budget={r.run_budget} id="rsi-run-budget" t={t} />}
          {r.llm.stop_reason != null && <div data-testid="rsi-llm-stop">{t('rsi.llm.stop', { reason: r.llm.stop_reason })}</div>}
          {r.llm.reason && <div>{r.llm.reason}</div>}
          {r.llm.error != null && <div className={css.brainError} data-testid="rsi-llm-error">
            {t('rsi.llm.errorDetail', { stage: r.llm.error.stage ?? '—', type: r.llm.error.type ?? '—', message: r.llm.error.message ?? '—' })}
          </div>}
          <details><summary>{t('rsi.llm.raw')}</summary><pre className={css.evidenceJson}>{JSON.stringify(r.llm, null, 2)}</pre></details>
        </div>
      </div>}
      {r.llm?.summary && <div className={css.beat} data-testid="rsi-analysis"><span className={css.beatLabel}>{t('rsi.analysis')}</span><span>{r.llm.summary}</span></div>}
      <details className={css.disclosure} data-testid="rsi-seed-evidence"><summary>{t('rsi.saw')}</summary>
        {summary !== '' && <div className={css.mono} data-testid="rsi-round-summary">{summary}</div>}
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
      </details>
      <div className={css.beat}><span className={css.beatLabel}>{t('rsi.tried')}</span><div>
        <SourceChip proposer={r.proposer} t={t} /> {describeTried(r.tried, t)}
        {typeof r.llm?.rationale === 'string' && r.llm.rationale !== '' && <div className={css.dim} data-testid="rsi-rationale">{r.llm.rationale}</div>}
      </div></div>
      {r.evaluation == null && <div className={css.beat}><span className={css.beatLabel}>{t('rsi.result')}</span><span className={css.mono}>{r.before} → {r.after} ({t('evolve.best')} {r.best})</span></div>}
      {r.evaluation == null && r.confirm != null && <div className={css.beat} data-testid="rsi-confirm"><span className={css.beatLabel}>{t('rsi.confirm')}</span><span className={css.mono}>{confirmLine(r, t)}</span></div>}
      {r.evaluation == null && <div className={css.beat}><span className={css.beatLabel}>{t('rsi.published')}</span><span>{r.published === true ? t('yes') : t('no')}</span></div>}
      {r.tried?.kind === 'none' && (r.needs ?? []).length > 0 && (
        <div className={css.beat}><span className={css.beatLabel}>{t('rsi.needs')}</span><span>{(r.needs ?? []).join(' · ')}</span></div>
      )}
      {r.usage != null && <div className={css.dim} data-testid="rsi-usage">{usageLine(r.usage, t)}</div>}
    </div>
  )
}
