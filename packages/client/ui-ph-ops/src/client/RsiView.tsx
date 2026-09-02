/** RSI page: the lightweight evolve loop (look → try → rerun the same seeds →
 * publish when better) as the one RSI surface, structured the way the loop
 * works. Head = task + evolution-mode session + 开始/继续 / 停止 + a one-line
 * status; then the session's campaigns (`rsiRun` per task the operational feed
 * saw claimed); then the picked campaign in loop order — ① 进度 (`rsiSeries`
 * chart), ② 每一轮 (per_seed / tried / result / published / needs), ③ 关键片段
 * (`rsiFrames` of the shown round + its dropped reasons), ④ 日志 (this brief's
 * runtime feed). The legacy heavy chain (prereg / blind twin / held-out) sits
 * collapsed at the bottom, rendered by view id through the owner's renderView.
 * Renders only — every count is campaign.json's, written by scripts/evolve.py. */

import { useCallback, useEffect, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { seedCount, statusLine } from './format.ts'
import { evolveSessions, pickEvolveDefault } from './OperatorRail.tsx'
import { usePolledLoad } from './poll.ts'
import type {
  Campaign, CampaignRound, RuntimeEvent, RuntimeEventsPayload, SeriesPoint, SessionSummary,
} from './types.ts'
import css from './ops.module.css'

/** The board faces this page drives, injected by the slot registration. */
export interface RsiInjected {
  /** POST /api/board/cards: the task picker's names come from `task_bindings`. */
  fetchCards: () => Promise<RemoteResult<unknown>>
  fetchSessions: () => Promise<RemoteResult<unknown>>
  fetchRuntimeEvents: (session: string) => Promise<RemoteResult<unknown>>
  /** POST /api/board/rsi_run: campaign.json + latest, or null when none. */
  fetchRsiRun: (session: string, task: string) => Promise<RemoteResult<unknown>>
  /** POST /api/board/rsi_series: per-round {round, before, after, best}. */
  fetchRsiSeries: (session: string, task: string) => Promise<RemoteResult<unknown>>
  /** POST /api/board/rsi_frames: kept media paths of one round. */
  fetchRsiFrames: (session: string, task: string, round: number) => Promise<RemoteResult<unknown>>
  /** POST /api/board/submit_brief: the brief JSON, verbatim. */
  submitBrief: (briefJson: string, session: string) => Promise<RemoteResult<unknown>>
  /** POST /api/board/cancel_brief: drop the cancel marker for one brief. */
  cancelBrief: (briefId: string, session: string) => Promise<RemoteResult<unknown>>
}

type T = PropsLocale<'phops'>['t']
interface Card { contributes?: { task_bindings?: string[] } }

const TERMINAL = new Set(['task_done', 'task_failed', 'task_cancelled'])

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

/** Inline SVG line chart of the series: x = round, y = success count. Three
 * polylines (before / after / best) over one axis; no chart library. */
export function SeriesChart({ series }: { series: SeriesPoint[] }) {
  const W = 320; const H = 120; const PAD = 10
  const top = Math.max(1, ...series.flatMap(p => [p.before ?? 0, p.after ?? 0, p.best ?? 0]))
  const x = (i: number) => PAD + (series.length < 2 ? 0 : (i * (W - 2 * PAD)) / (series.length - 1))
  const y = (v: number) => H - PAD - (v / top) * (H - 2 * PAD)
  const line = (k: 'before' | 'after' | 'best') => series.map((p, i) => `${x(i)},${y(p[k] ?? 0)}`).join(' ')
  return (
    <svg className={css.chart} viewBox={`0 0 ${W} ${H}`} role="img">
      <line className={css.chartAxis} x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} />
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

export function RsiView({
  fetchCards, fetchSessions, fetchRuntimeEvents, fetchRsiRun, fetchRsiSeries, fetchRsiFrames,
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
  usePolledLoad(load)

  const sessionName = session ?? pickEvolveDefault(sessions)
  const current = campaigns?.find(c => c.task === task) ?? null
  const shownRound = round ?? current?.latest?.round ?? null
  const shown = current?.rounds?.find(r => r.round === shownRound) ?? null
  useEffect(() => {
    if (sessionName === null || task === null || shownRound === null) { setFrames([]); return }
    let live = true
    fetchRsiFrames(sessionName, task, shownRound)
      .then((r) => { if (live && r.ok) setFrames(Array.isArray(r.value) ? r.value as string[] : []) })
      .catch(() => { if (live) setFrames([]) })
    return () => { live = false }
  }, [fetchRsiFrames, sessionName, task, shownRound])

  const { ids, open } = task === null ? { ids: new Set<string>(), open: null } : briefsOf(events, task)
  const log = events.filter(e => typeof e.brief === 'string' && ids.has(e.brief))

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
        {current !== null && <span className={css.dim}>{statusLine(current, t)}</span>}
        {error !== null && <span className={css.brainError}>{error}</span>}
      </div>

      {campaigns.length === 0
        ? <div className={css.state}>{t('evolve.empty')}</div>
        : (
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
        ? campaigns.length > 0 && <div className={css.state}>{t('evolve.select')}</div>
        : (
          <>
            <h3 className={css.secTitle}>{t('rsi.sec.progress')} <span className={css.dim}>{t('evolve.chart')}</span></h3>
            <SeriesChart series={series} />

            <h3 className={css.secTitle}>{t('rsi.sec.rounds')}</h3>
            {(current.rounds ?? []).map(r => (
              <RoundCard key={r.round} r={r} selected={r.round === shownRound} onPick={() => { setRound(r.round ?? null) }} t={t} />
            ))}

            <h3 className={css.secTitle}>{t('rsi.sec.frames')}{shownRound !== null ? ` · ${t('rsi.roundN', { r: shownRound })}` : ''}</h3>
            {frames.length === 0
              ? <div className={css.dim}>{t('evolve.noMedia')}</div>
              : <div className={css.media}>{frames.map(p => <MediaCard key={p} session={sessionName ?? ''} path={p} />)}</div>}
            {Object.entries(shown?.media_dropped ?? {}).map(([k, why]) => (
              <div key={k} className={css.dim}><span className={css.mono}>{k}</span> · {t('rsi.dropped')}: {why}</div>
            ))}

            <h3 className={css.secTitle}>{t('rsi.sec.log')}</h3>
            {log.length === 0
              ? <div className={css.dim}>{t('evolve.noLog')}</div>
              : <pre className={css.log}>{log.map(e => JSON.stringify(e)).join('\n')}</pre>}
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
function RoundCard({ r, selected, onPick, t }: { r: CampaignRound; selected: boolean; onPick: () => void; t: T }) {
  const seeds = r.per_seed ?? []
  return (
    <div className={`${css.card} ${css.rowBtn} ${selected ? css.rowSelected : ''}`} onClick={onPick}>
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
