/** 任务图 mission cockpit: the graph-first view of the running mission. Reads the
 * session chain + the Python-side progress fold through the board Remote and
 * renders only — every count is board.store's. The goal → task node → stage
 * pipeline and the capability-wiring fan are one interactive React Flow DAG;
 * clicking a node opens its evidence beside the graph. Honest empty states: a
 * session with no sealed task shows an idle graph, never invented liveness. */

import { useCallback, useMemo, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { finite, pct } from './format.ts'
import { usePolledLoad } from './poll.ts'
import { buildGraph, type NodeDatum } from './graphModel.ts'
import { MissionGraph } from './MissionGraph.tsx'
import type { PlanComplete, SessionDetail, SessionProgress, SessionSummary } from './types.ts'
import css from './ops.module.css'

/** The three board reads this cockpit drives, injected by the slot registration. */
export interface CockpitInjected {
  fetchSessions: () => Promise<RemoteResult<unknown>>
  fetchSession: (name: string) => Promise<RemoteResult<unknown>>
  fetchSessionProgress: (name: string) => Promise<RemoteResult<unknown>>
}

/** Prefer the resident execution session, else the newest (list is newest-first). */
function pickDefault(list: SessionSummary[]): string | null {
  return list.find(s => s.name === 'session-main')?.name ?? list[0]?.name ?? null
}

type T = PropsLocale<'phops'>['t']

export function CockpitView({
  fetchSessions, fetchSession, fetchSessionProgress, t,
}: ConvViewProps & InjectFace<CockpitInjected> & PropsLocale<'phops'>) {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [progress, setProgress] = useState<SessionProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runIndex, setRunIndex] = useState<number | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const load = useCallback(async () => {
    const s = await fetchSessions()
    if (!s.ok) { setError(s.error.message); return }
    setError(null)
    const list = s.value as SessionSummary[]
    setSessions(list)
    const chosen = name ?? pickDefault(list)
    if (name === null && chosen !== null) setName(chosen)
    if (chosen === null) { setDetail(null); setProgress(null); return }
    const [d, p] = await Promise.all([fetchSession(chosen), fetchSessionProgress(chosen)])
    if (d.ok) setDetail(d.value as SessionDetail)
    if (p.ok) setProgress(p.value as SessionProgress)
  }, [name, fetchSessions, fetchSession, fetchSessionProgress])

  usePolledLoad(load)

  const runs: PlanComplete[] = detail?.rows?.['task.plan_complete'] ?? []
  const resolvedIndex = runIndex ?? (runs.length > 0 ? runs.length - 1 : 0)
  const run = runs[resolvedIndex] ?? null
  const wiring = detail?.rows?.['capability.resolve'] ?? []
  const boot = detail?.rows?.['runtime.boot']?.[0]
  const goalFallback = progress?.latest?.goal ?? run?.goal ?? ''

  const graph = useMemo(
    () => buildGraph(run, wiring, goalFallback),
    [run, wiring, goalFallback],
  )
  const graphKey = `${name ?? ''}:${resolvedIndex}:${graph.nodes.length}`
  const selectedDatum = graph.nodes.find(n => n.id === selectedNode)?.data ?? null

  const switchSession = (next: string) => {
    setName(next)
    setRunIndex(null)
    setSelectedNode(null)
  }

  if (sessions === null) {
    return <div className={css.state}>{error === null ? t('loading') : `${t('unavailable')} — ${error}`}</div>
  }

  return (
    <div className={css.cockpit}>
      <header className={css.cockpitHead}>
        <div className={css.headLeft}>
          <select
            className={css.sessionPick}
            value={name ?? ''}
            onChange={(e) => { switchSession(e.target.value) }}
          >
            {sessions.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
          <ModeBadge mode={boot?.mode} />
          <span className={css.goal}>{goalFallback || t('idle')}</span>
        </div>
        <ProgressStat progress={progress} t={t} />
      </header>

      {runs.length > 1 ? (
        <div className={css.runPills} role="tablist" aria-label={t('runs')}>
          {runs.map((r, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === resolvedIndex}
              className={[
                css.runPill,
                r.success === true ? css.state_pass : css.state_fail,
                i === resolvedIndex ? css.runPillActive : '',
              ].filter(Boolean).join(' ')}
              onClick={() => { setRunIndex(i); setSelectedNode(null) }}
            >
              {t('run')} {i + 1}
            </button>
          ))}
        </div>
      ) : null}

      <div className={css.cockpitBody}>
        <section className={css.graphPane}>
          <div className={css.paneLabel}>
            {t('graph.execution')} <span className={css.paneDim}>· {t('graph.wiring')}</span>
          </div>
          {graph.nodes.length <= 1 && runs.length === 0
            ? <div className={css.graphEmpty}>{t('graph.empty')}</div>
            : (
              <MissionGraph
                nodes={graph.nodes}
                edges={graph.edges}
                graphKey={graphKey}
                selectedId={selectedNode}
                onSelect={setSelectedNode}
              />
            )}
        </section>
        <aside className={css.evidence}>
          {selectedDatum === null
            ? <div className={css.state}>{t('selectNode')}</div>
            : <Evidence datum={selectedDatum} t={t} />}
          <ChainStrip kinds={detail?.kinds} t={t} />
        </aside>
      </div>
    </div>
  )
}

/** MODE chip — the execution/evolution firewall, colored distinctly. */
function ModeBadge({ mode }: { mode?: string | null | undefined }) {
  const known = mode === 'execution' || mode === 'evolution'
  const cls = `${css.mode} ${mode === 'evolution' ? css.modeEvolution : mode === 'execution' ? css.modeExecution : css.modeUnknown}`
  return <span className={cls}>{known ? mode : 'MODE ?'}</span>
}

/** The one-line progress readout from the Python fold (no TS math). */
function ProgressStat({ progress, t }: { progress: SessionProgress | null } & { t: T }) {
  if (progress === null) return null
  const done = progress.succeeded ?? 0
  const total = progress.tasks ?? 0
  return (
    <div className={css.progressStat}>
      <span className={css.statBig}>{done}<span className={css.statSlash}>/{total}</span></span>
      <span className={css.statUnit}>{t('success')}</span>
      <span className={css.statSep} />
      <span className={css.statCell}>{t('stagePass')} <b>{pct(progress.stage_pass_rate)}</b></span>
      <span className={css.statCell}>{t('replans')} <b>{progress.replans ?? 0}</b></span>
      <span className={css.statCell}>{t('faults')} <b>{progress.faults ?? 0}</b></span>
      {finite(progress.task_errors) && (progress.task_errors ?? 0) > 0
        ? <span className={`${css.statCell} ${css.statAlert}`}>{t('taskErrors')} <b>{progress.task_errors}</b></span>
        : null}
    </div>
  )
}

/** Evidence for the clicked graph node — the raw source row, shaped per kind. */
function Evidence({ datum, t }: { datum: NodeDatum } & { t: T }) {
  const rows: Array<[string, string]> = []
  if (datum.kind === 'capability') {
    const cap = datum.detail as { capability?: string; consumer?: string; ref?: string; privileged?: boolean }
    rows.push([t('capability'), cap.capability ?? '—'])
    rows.push([t('provider'), cap.ref ?? '—'])
    rows.push([t('consumer'), cap.consumer ?? '—'])
    rows.push([t('privileged'), cap.privileged ? t('on') : t('off')])
  } else if (datum.kind === 'stage') {
    const st = datum.detail as { name?: string; success?: boolean | null }
    rows.push([t('stage'), st.name ?? '—'])
    rows.push([t('success'), st.success === true ? t('on') : t('off')])
  } else if (datum.kind === 'node') {
    const nd = datum.detail as { success?: boolean | null; stages?: unknown[] }
    rows.push([t('node'), datum.label])
    rows.push([t('success'), nd.success === true ? t('on') : t('off')])
    rows.push([t('stages'), String(nd.stages?.length ?? 0)])
  } else {
    const r = datum.detail as PlanComplete | null
    rows.push([t('goal'), datum.label])
    rows.push([t('success'), r?.success === true ? t('success') : t('failure')])
    rows.push([t('replans'), String(r?.replans ?? 0)])
    rows.push([t('actuations'), String(r?.actuations ?? 0)])
    rows.push([t('faults'), String(r?.faults?.length ?? 0)])
  }
  return (
    <div className={css.evidenceBox}>
      <div className={css.evidenceHead}>
        <span className={`${css.evidenceKind} ${datum.state ? css[`state_${datum.state}`] : ''}`}>{datum.kind}</span>
      </div>
      <dl className={css.dl}>
        {rows.map(([k, v]) => (
          <div key={k} className={css.dlRow}>
            <dt className={css.dt}>{k}</dt>
            <dd className={css.dd}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** The session chain's composition: one chip per note kind with its count. */
function ChainStrip({ kinds, t }: { kinds?: Record<string, number> | undefined } & { t: T }) {
  const entries = Object.entries(kinds ?? {})
  if (entries.length === 0) return null
  return (
    <div className={css.chainStrip}>
      <div className={css.chainLabel}>{t('chain')}</div>
      <div className={css.chainChips}>
        {entries.map(([k, n]) => (
          <span key={k} className={css.chainChip}><b>{n}</b> {k}</span>
        ))}
      </div>
    </div>
  )
}
