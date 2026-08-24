/** The operator rail: a persistent sidebar section of at-a-glance panels — a
 * mission mini-map, a progress card, runtime vitals, and an evolution ticker —
 * so a robotics-harness operator sees where the mission is, whether it is making
 * progress, whether the machine is healthy, and whether it is getting better
 * WITHOUT clicking. Renders only: every count is board.store's (the Python
 * `session_progress` fold and the session chain). Collapses to status dots when
 * the column is an icon rail. Honest empty states throughout — a null runtime
 * status shows "no live status", never a fabricated heartbeat. */

import { useCallback, useEffect, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { SidebarSectionProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { agoSeconds, finite, pct } from './format.ts'
import { Term } from './chrome.tsx'
import { usePolledLoad } from './poll.ts'
import type {
  BootRow, PlanComplete, RuntimeStatus, SessionDetail, SessionProgress, SessionSummary,
} from './types.ts'
import css from './ops.module.css'

/** The board reads the rail drives, injected by the slot registration. */
export interface RailInjected {
  fetchSessions: () => Promise<RemoteResult<unknown>>
  fetchSession: (name: string) => Promise<RemoteResult<unknown>>
  fetchSessionProgress: (name: string) => Promise<RemoteResult<unknown>>
  fetchRuntimeStatus: (name: string) => Promise<RemoteResult<unknown>>
  fetchStores: () => Promise<RemoteResult<unknown>>
  fetchRounds: () => Promise<RemoteResult<unknown>>
}

interface StoreSummary { name?: string; task?: string | null; generations?: number; promoted?: number }
interface Round { round?: number | null; title?: string | null }
type T = PropsLocale<'phops'>['t']

/* jscpd:ignore-start */
function pickDefault(list: SessionSummary[]): string | null {
  return list.find(s => s.name === 'session-main')?.name ?? list[0]?.name ?? null
}
function renderOn(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return !['', 'off', 'none', 'false', '0'].includes(value.trim().toLowerCase())
  return value != null
}
/* jscpd:ignore-end */

export function OperatorRail({
  wide, fetchSessions, fetchSession, fetchSessionProgress, fetchRuntimeStatus, fetchStores, fetchRounds, t,
}: SidebarSectionProps & InjectFace<RailInjected> & PropsLocale<'phops'>) {
  const [latest, setLatest] = useState<SessionSummary | null>(null)
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [progress, setProgress] = useState<SessionProgress | null>(null)
  const [rtStatus, setRtStatus] = useState<RuntimeStatus | null>(null)
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [online, setOnline] = useState<boolean | null>(null)
  const [now, setNow] = useState(() => Date.now())

  /* jscpd:ignore-start */
  const load = useCallback(async () => {
    const s = await fetchSessions()
    if (!s.ok) { setOnline(false); return }
    setOnline(true)
    const list = s.value as SessionSummary[]
    const top = list.find(x => x.name === pickDefault(list)) ?? null
    /* jscpd:ignore-end */
    setLatest(top)
    if (top?.name === undefined) { setDetail(null); setProgress(null); setRtStatus(null); return }
    const [d, p, r, st, rd] = await Promise.all([
      fetchSession(top.name), fetchSessionProgress(top.name), fetchRuntimeStatus(top.name),
      fetchStores(), fetchRounds(),
    ])
    if (d.ok) setDetail(d.value as SessionDetail)
    if (p.ok) setProgress(p.value as SessionProgress)
    setRtStatus(r.ok ? ((r.value as RuntimeStatus | null) ?? null) : null)
    if (st.ok) setStores(st.value as StoreSummary[])
    if (rd.ok) setRounds(rd.value as Round[])
  }, [fetchSessions, fetchSession, fetchSessionProgress, fetchRuntimeStatus, fetchStores, fetchRounds])

  usePolledLoad(load)
  // Local clock so the heartbeat age counts up between polls (no network).
  useEffect(() => {
    const tick = setInterval(() => { setNow(Date.now()) }, 1000)
    return () => { clearInterval(tick) }
  }, [])

  const boot: BootRow | undefined = detail?.rows?.['runtime.boot']?.[0]
  const runs: PlanComplete[] = detail?.rows?.['task.plan_complete'] ?? []
  const secs = agoSeconds(latest?.mtime, now)

  if (!wide) {
    return <CollapsedRail runs={runs} progress={progress} mode={boot?.mode} secs={secs} online={online} />
  }

  return (
    <div className={css.rail}>
      <div className={css.railTitle}>{t('rail.title')}</div>
      <MissionCard runs={runs} progress={progress} t={t} />
      <ProgressCard progress={progress} t={t} />
      <VitalsCard boot={boot} rtStatus={rtStatus} secs={secs} online={online} t={t} />
      <EvolutionCard stores={stores} rounds={rounds} t={t} />
    </div>
  )
}

/** Mission mini-map: run outcome dots + the latest task's node → stage chips. */
function MissionCard({ runs, progress, t }: { runs: PlanComplete[]; progress: SessionProgress | null } & { t: T }) {
  const latest = progress?.latest ?? runs[runs.length - 1] ?? null
  const nodeEntries = Object.entries(latest?.nodes ?? {})
  return (
    <section className={css.card}>
      <div className={css.cardHead}>{t('card.mission')}</div>
      {runs.length === 0 ? <div className={css.cardEmpty}>{t('graph.empty')}</div> : (
        <>
          <div className={css.dotRow} title={`${runs.length} ${t('runs')}`}>
            {runs.map((r, i) => (
              <span key={i} className={`${css.runDot} ${r.success === true ? css.state_pass : css.state_fail}`} />
            ))}
          </div>
          {latest?.goal ? <div className={css.miniGoal}>{latest.goal}</div> : null}
          {nodeEntries.map(([nodeName, node]) => (
            <div key={nodeName} className={css.pipeline}>
              <span className={`${css.pipeNode} ${node.success === true ? css.state_pass : css.state_fail}`}>{nodeName}</span>
              {(node.stages ?? []).map((st, i) => (
                <span
                  key={i}
                  className={`${css.pipeStage} ${st.success === true ? css.state_pass : css.state_fail}`}
                >
                  {st.name ?? `s${i + 1}`}
                </span>
              ))}
            </div>
          ))}
        </>
      )}
    </section>
  )
}

/** Progress card: succeeded/total + a stage-pass meter + the fault tallies. */
function ProgressCard({ progress, t }: { progress: SessionProgress | null } & { t: T }) {
  const done = progress?.succeeded ?? 0
  const total = progress?.tasks ?? 0
  const rate = finite(progress?.stage_pass_rate)
  return (
    <section className={css.card}>
      <div className={css.cardHead}>{t('card.progress')}</div>
      <div className={css.progRow}>
        <span className={css.progBig}>{done}<span className={css.statSlash}>/{total}</span></span>
        <span className={css.progUnit}>{t('tasks')}</span>
      </div>
      <div className={css.meterLabel}><Term label={t('stagePass')} tip={t('stagePass.tip')} /> <b>{pct(progress?.stage_pass_rate)}</b></div>
      <div className={css.meterTrack}>
        <span className={css.meterFill} style={{ width: `${(rate ?? 0) * 100}%` }} />
      </div>
      <div className={css.tallies}>
        <span><Term label={t('replans')} tip={t('replan.tip')} /> <b>{progress?.replans ?? 0}</b></span>
        <span>{t('faults')} <b>{progress?.faults ?? 0}</b></span>
        {(progress?.task_errors ?? 0) > 0
          ? <span className={css.statAlert}>{t('taskErrors')} <b>{progress?.task_errors}</b></span>
          : null}
      </div>
    </section>
  )
}

/** Runtime vitals: MODE, heartbeat age, skills, mount sha, viewfinder. */
function VitalsCard({
  boot, rtStatus, secs, online, t,
}: { boot?: BootRow | undefined; rtStatus: RuntimeStatus | null; secs: number | null; online: boolean | null } & { t: T }) {
  const sha = boot?.mount_plan_sha
  return (
    <section className={css.card}>
      <div className={css.cardHead}>{t('card.vitals')}</div>
      <div className={css.vitalRow}>
        <span className={css.vitalLabel}>{t('mode')}</span>
        <span className={`${css.mode} ${boot?.mode === 'evolution' ? css.modeEvolution : boot?.mode === 'execution' ? css.modeExecution : css.modeUnknown}`}>
          {boot?.mode ?? t('modeUnknown')}
        </span>
      </div>
      <div className={css.vitalRow}>
        <span className={css.vitalLabel}>{t('heartbeat')}</span>
        <span>{secs === null ? '—' : `${secs}s ${t('ago')}`}</span>
      </div>
      <div className={css.vitalRow}>
        <span className={css.vitalLabel}>{t('skills')}</span>
        <span>{boot?.skills_manifest?.length ?? 0}</span>
      </div>
      {sha ? (
        <div className={css.vitalRow}>
          <span className={css.vitalLabel}><Term label={t('mountPlan')} tip={t('mountPlan.tip')} /></span>
          <span className={css.mono}>{sha.slice(0, 8)}</span>
        </div>
      ) : null}
      <div className={css.vitalRow}>
        <span className={css.vitalLabel}><Term label={t('viewfinder')} tip={t('viewfinder.tip')} /></span>
        {rtStatus === null
          ? <span className={css.dim}>{online === false ? t('off') : '—'}</span>
          : (
            <span>
              {renderOn(rtStatus.render) ? t('on') : t('off')}
              {rtStatus.pid == null ? '' : <span className={css.mono}> {t('pid')} {rtStatus.pid}</span>}
            </span>
          )}
      </div>
    </section>
  )
}

/** Evolution ticker: the latest round headline + the newest campaign's tally. */
function EvolutionCard({ stores, rounds, t }: { stores: StoreSummary[]; rounds: Round[] } & { t: T }) {
  const round = rounds[0]
  const store = stores[0]
  return (
    <section className={css.card}>
      <div className={css.cardHead}>{t('card.evolution')}</div>
      <div className={css.evoRow}>
        <span className={css.vitalLabel}>{t('latestRound')}</span>
        <span className={css.evoTitle}>{round ? `#${round.round} ${round.title ?? ''}` : t('noRounds')}</span>
      </div>
      <div className={css.evoRow}>
        <span className={css.vitalLabel}>{store?.name ?? t('noCampaign')}</span>
        {store ? <span>{store.promoted ?? 0}/{store.generations ?? 0} <Term label={t('promoted')} tip={t('promoted.tip')} /></span> : null}
      </div>
    </section>
  )
}

/** The 56px rail form: status dots only — mission outcomes, MODE, progress. */
interface CollapsedRailProps {
  runs: PlanComplete[]
  progress: SessionProgress | null
  mode?: string | null | undefined
  secs: number | null
  online: boolean | null
}
function CollapsedRail({ runs, progress, mode, secs, online }: CollapsedRailProps) {
  return (
    <div className={css.railMini} title="operations">
      <div className={css.miniDots}>
        {runs.slice(-6).map((r, i) => (
          <span key={i} className={`${css.miniDot} ${r.success === true ? css.state_pass : css.state_fail}`} />
        ))}
      </div>
      <span className={`${css.miniMode} ${mode === 'evolution' ? css.modeEvolution : mode === 'execution' ? css.modeExecution : css.modeUnknown}`} />
      <span className={css.miniCount}>{progress?.succeeded ?? 0}/{progress?.tasks ?? 0}</span>
      <span className={`${css.miniHeart} ${online === false ? css.state_fail : secs === null ? css.dim : css.state_pass}`} />
    </div>
  )
}
