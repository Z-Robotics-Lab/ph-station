/** 演化 view: the lightweight evolve loop, visible / stoppable / resumable.
 * Lists the session's evolve campaigns (`rsiRun` per task the operational feed
 * has seen claimed), starts one from a task name alone (`submitBrief` with
 * `{"kind":"evolve","task"}` — every other field is the runtime's default),
 * and for the picked campaign shows its rounds, the `rsiSeries` line chart as
 * inline SVG, the `rsiFrames` media paths of one round, and this brief's lines
 * of the runtime feed. Stop = `cancelBrief` on the open brief; resume = the same
 * brief resubmitted (the runtime continues from campaign.json's cursor). Renders
 * only — every count is campaign.json's, written by scripts/evolve.py. */

import { useCallback, useEffect, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { pickDefault } from './OperatorRail.tsx'
import { usePolledLoad } from './poll.ts'
import type {
  Campaign, RuntimeEvent, RuntimeEventsPayload, SeriesPoint, SessionSummary,
} from './types.ts'
import css from './ops.module.css'

/** The board faces this page drives, injected by the slot registration. */
export interface EvolveInjected {
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

const TERMINAL = new Set(['task_done', 'task_failed', 'task_cancelled'])

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

/** Evolve briefs are accepted only by evolution-mode runtimes: offer those (a live one
 * first); fall back to every session only when no row carries a mode at all. */
export function evolveSessions(list: SessionSummary[]): SessionSummary[] {
  const evo = list.filter(s => s.mode === 'evolution')
  return evo.length > 0 ? evo : list
}
export function pickEvolveDefault(list: SessionSummary[]): string | null {
  const pool = evolveSessions(list)
  return (pool.find(s => s.runtime_alive === true) ?? pool[0])?.name ?? pickDefault(pool)
}

export function EvolveView({
  fetchSessions, fetchRuntimeEvents, fetchRsiRun, fetchRsiSeries, fetchRsiFrames, submitBrief, cancelBrief, t,
}: ConvViewProps & InjectFace<EvolveInjected> & PropsLocale<'phops'>) {
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

  const load = useCallback(async () => {
    try {
      const s = await fetchSessions()
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
  }, [fetchSessions, fetchRuntimeEvents, fetchRsiRun, fetchRsiSeries, session, known, task])
  usePolledLoad(load)

  const sessionName = session ?? pickEvolveDefault(sessions)
  const current = campaigns?.find(c => c.task === task) ?? null
  const shownRound = round ?? current?.latest?.round ?? null
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

  /** Start or resume: the brief is `{kind:"evolve", task}` and nothing else. */
  const start = useCallback(async (tk: string) => {
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
  }, [submitBrief, sessionName, t])

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

  if (online === false) return <div className={css.state}>{t('unavailable')}</div>
  if (campaigns === null) return <div className={css.state}>{t('loading')}</div>
  return (
    <div className={css.page}>
      <div className={css.pageHead}>
        <label>{t('brain.session')} <select value={sessionName ?? ''} onChange={(e) => { setSession(e.target.value); setTask(null) }}>
          {evolveSessions(sessions).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select></label>
        <label>{t('evolve.task')} <input value={draft} placeholder={t('evolve.taskHint')}
          onChange={(e) => { setDraft(e.target.value) }} /></label>
        <button type="button" disabled={busy || draft.trim() === '' || sessionName === null} onClick={() => { void start(draft.trim()) }}>
          {busy ? t('evolve.starting') : t('evolve.start')}
        </button>
        {error !== null && <span className={css.brainError}>{error}</span>}
      </div>

      {campaigns.length === 0
        ? <div className={css.state}>{t('evolve.empty')}</div>
        : (
          <table className={css.table}>
            <thead><tr>
              <th>{t('evolve.task')}</th><th>{t('evolve.status')}</th><th>{t('evolve.seeds')}</th>
              <th>{t('evolve.arm')}</th><th>{t('evolve.round')}</th><th>{t('evolve.best')}</th>
            </tr></thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.task} className={`${css.rowBtn} ${c.task === task ? css.rowSelected : ''}`}
                  onClick={() => { setTask(c.task ?? null); setRound(null) }}>
                  <td className={css.mono}>{c.task}</td>
                  <td>{c.status}</td>
                  <td className={css.mono}>{(c.seeds ?? []).join('–')}</td>
                  <td>{c.arm}</td>
                  <td className={css.mono}>{c.latest?.round ?? c.cursor ?? 0}</td>
                  <td className={css.mono}>{c.best}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      {current === null
        ? campaigns.length > 0 && <div className={css.state}>{t('evolve.select')}</div>
        : (
          <div className={css.card}>
            <div className={css.pageHead}>
              <span className={css.mono}>{current.task}</span>
              <span>{current.status}</span>
              {open !== null
                ? <button type="button" disabled={busy} onClick={() => { void stop() }}>{t('evolve.stop')}</button>
                : <button type="button" disabled={busy} onClick={() => { void start(current.task ?? '') }}>{t('evolve.resume')}</button>}
            </div>
            <div className={css.dim}>{t('evolve.chart')}</div>
            <SeriesChart series={series} />
            <table className={css.table}>
              <thead><tr>
                <th>{t('evolve.round')}</th><th>{t('evolve.tried')}</th><th>{t('evolve.before')}</th>
                <th>{t('evolve.after')}</th><th>{t('evolve.best')}</th><th>{t('evolve.published')}</th>
              </tr></thead>
              <tbody>
                {(current.rounds ?? []).map(r => (
                  <tr key={r.round} className={`${css.rowBtn} ${r.round === shownRound ? css.rowSelected : ''}`}
                    onClick={() => { setRound(r.round ?? null) }}>
                    <td className={css.mono}>{r.round}</td>
                    <td className={css.mono}>{r.tried?.kind}{r.tried?.node !== undefined ? ` @ ${r.tried.node}` : ''}</td>
                    <td className={css.mono}>{r.before}</td>
                    <td className={css.mono}>{r.after}</td>
                    <td className={css.mono}>{r.best}</td>
                    <td>{r.published === true ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={css.dim}>{t('evolve.media')}{shownRound !== null ? ` · ${t('evolve.round')} ${shownRound}` : ''}</div>
            {frames.length === 0
              ? <div className={css.dim}>{t('evolve.noMedia')}</div>
              : <div className={css.media}>{frames.map(p => <span key={p} className={css.mediaItem}>{p}</span>)}</div>}
            <div className={css.dim}>{t('evolve.log')}</div>
            {log.length === 0
              ? <div className={css.dim}>{t('evolve.noLog')}</div>
              : <pre className={css.log}>{log.map(e => JSON.stringify(e)).join('\n')}</pre>}
          </div>
        )}
    </div>
  )
}
