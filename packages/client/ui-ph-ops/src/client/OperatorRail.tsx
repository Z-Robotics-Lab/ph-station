/** The operator rail: a persistent sidebar section of at-a-glance panels — a
 * mission mini-map, a progress card, runtime vitals, and an evolution ticker —
 * so a robotics-harness operator sees where the mission is, whether it is making
 * progress, whether the machine is healthy, and whether it is getting better
 * WITHOUT clicking. Renders only: every count is board.store's (the Python
 * `session_progress` fold and the session chain). Collapses to status dots when
 * the column is an icon rail. Honest empty states throughout — a null runtime
 * status shows "no live status", never a fabricated heartbeat. */

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { SidebarSectionProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  IconActivity, IconBox, IconBroadcast, IconCpu, IconRoute, IconSitemap, IconTarget,
  IconTrendingUp, IconViewfinder,
} from '@deepseek-ai/dsh-client-ui-ph-icons'
import { agoSeconds, finite, formatAgo, pct } from './format.ts'
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
/** The current-runtime session: newest (board sorts mtime-desc) carrying a
 * `runtime.boot` chain row, else newest of any kind. A local twin of the status
 * bar's and livegraph's rule (the ph panel packages stay decoupled) so all three
 * name one session — a completed campaign at index 0 no longer splits the rail
 * (EXECUTION) from the status bar (未知). Replaces a hardcoded 'session-main'. */
function pickDefault(list: SessionSummary[]): string | null {
  return (list.find(s => s.kinds?.['runtime.boot'] !== undefined) ?? list[0])?.name ?? null
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
    try {
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
    } catch {
      // A board read folds carrier failures into `ok: false`, but assembly
      // faults (arg/codec/Context) reject; a rejected poll must read as board
      // offline, never leave the rail stuck on 模式 未知 / 技能 0. The next
      // healthy poll sets online + detail again, so the cards return to live.
      setOnline(false)
    }
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

/* ── presentation helpers ────────────────────────────────────────────────── */

/** The sealed verdict a chip/dot/badge paints, from an optional success flag: a
 * missing flag is `pending` (not yet sealed), never a failure. */
type PhState = 'pass' | 'fail' | 'pending'
const phState = (success?: boolean | null): PhState =>
  (success === true ? 'pass' : success === false ? 'fail' : 'pending')
/** Sets the `--st` status hue an element and its parts read; inherits down. */
const stCss: Record<PhState, string> = { pass: css.stPass ?? '', fail: css.stFail ?? '', pending: css.stPend ?? '' }
const stGlyph: Record<PhState, string> = { pass: '✓', fail: '✗', pending: '·' }

/** Heartbeat freshness from the age the poller already computed. `ponytail:
 * fixed 60s/600s cutoffs — expose as config if a deployment needs its own. */
type Fresh = 'fresh' | 'aging' | 'stale' | 'off' | 'none'
function heartState(secs: number | null, online: boolean | null): Fresh {
  if (online === false) return 'off'
  if (secs === null) return 'none'
  if (secs < 60) return 'fresh'
  if (secs < 600) return 'aging'
  return 'stale'
}
const heartCss: Record<Fresh, string> = {
  fresh: css.stPass ?? '', aging: css.stAmber ?? '', stale: css.stPend ?? '', off: css.stFail ?? '', none: css.stPend ?? '',
}

/** A card section header: a tabler glyph leading the card title. */
function CardHead({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className={css.cardHead}>
      <span className={css.cardHeadIcon}>{icon}</span>
      <span className={css.cardHeadTitle}>{children}</span>
    </div>
  )
}

/** One label:value vitals line: a leading glyph + label on the left, value right. */
function VitalRow({ icon, label, children }: { icon: ReactNode; label: ReactNode; children: ReactNode }) {
  return (
    <div className={css.vitalRow}>
      <span className={css.vitalLabel}><span className={css.vitalIcon}>{icon}</span>{label}</span>
      <span className={css.vitalValue}>{children}</span>
    </div>
  )
}

/** Mission mini-map: a status-dot title, the run-outcome strip, then the latest
 * task's node chips — each a colored state glyph + name + a `N/total` stage
 * badge; clicking a chip expands its stage strip in place. Chips group by
 * verdict (fail › pending › pass) so trouble surfaces first: the fold delivers
 * the node map name-sorted, not in execution order. Far-LOD sibling of 执行图谱. */
function MissionCard({ runs, progress, t }: { runs: PlanComplete[]; progress: SessionProgress | null } & { t: T }) {
  const latest = progress?.latest ?? runs[runs.length - 1] ?? null
  const nodes = Object.entries(latest?.nodes ?? {})
    .sort(([, a], [, b]) => ({ fail: 0, pending: 1, pass: 2 })[phState(a.success)] - ({ fail: 0, pending: 1, pass: 2 })[phState(b.success)])
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }
  return (
    <section className={css.card}>
      <CardHead icon={<IconRoute size={14} />}>{t('card.mission')}</CardHead>
      {runs.length === 0 ? <div className={css.cardEmpty}>{t('graph.empty')}</div> : (
        <>
          {latest?.goal
            ? (
              <div className={css.missionGoal}>
                <span className={`${css.goalDot} ${stCss[phState(latest.success)]}`} />
                <span className={css.goalText}>{latest.goal}</span>
              </div>
            )
            : null}
          <div className={css.dotRow} title={`${runs.length} ${t('runs')}`}>
            {runs.map((r, i) => (
              <span key={i} className={`${css.runDot} ${stCss[phState(r.success)]}`} />
            ))}
          </div>
          <div className={css.chips}>
            {nodes.map(([nodeName, node]) => {
              const stages = node.stages ?? []
              const open = expanded.has(nodeName)
              const ok = stages.filter(s => s.success === true).length
              const st = phState(node.success)
              return (
                <div key={nodeName} className={css.pipeline}>
                  <button
                    type="button"
                    className={`${css.chip} ${css.chipBtn} ${stCss[st]}`}
                    onClick={() => { toggle(nodeName) }}
                    aria-expanded={open}
                    title={t(open ? 'collapse' : 'expand')}
                  >
                    <span className={css.chipGlyph}>{stGlyph[st]}</span>
                    <span className={css.chipName}>{nodeName}</span>
                    {stages.length > 0
                      ? <span className={css.stageBadge}>{open ? '▾' : `${ok}/${stages.length}`}</span>
                      : null}
                  </button>
                  {open
                    ? stages.map((s, i) => (
                      <span key={i} className={`${css.chip} ${css.stageChip} ${stCss[phState(s.success)]}`}>
                        <span className={css.chipGlyph}>{stGlyph[phState(s.success)]}</span>
                        {s.name ?? `s${i + 1}`}
                      </span>
                    ))
                    : null}
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

/** Progress card: a succeeded/total stat tile, a health-colored stage-pass
 * meter, and the replan/fault tallies as small labeled badges. */
function ProgressCard({ progress, t }: { progress: SessionProgress | null } & { t: T }) {
  const done = progress?.succeeded ?? 0
  const total = progress?.tasks ?? 0
  const rate = finite(progress?.stage_pass_rate)
  const health = rate === null ? css.meterNone : rate >= 0.8 ? css.meterPass : rate >= 0.5 ? css.meterAmber : css.meterFail
  const faults = progress?.faults ?? 0
  return (
    <section className={css.card}>
      <CardHead icon={<IconTarget size={14} />}>{t('card.progress')}</CardHead>
      <div className={css.statTile}>
        <span className={css.statBig}>{done}<span className={css.statSlash}>/{total}</span></span>
        <span className={css.statUnit}>{t('tasks')}</span>
      </div>
      <div className={css.meterLabel}><Term label={t('stagePass')} tip={t('stagePass.tip')} /> <b>{pct(progress?.stage_pass_rate)}</b></div>
      <div className={css.meterTrack}>
        <span className={`${css.meterFill} ${health}`} style={{ width: `${(rate ?? 0) * 100}%` }} />
      </div>
      <div className={css.tallies}>
        <span className={css.tally}><Term label={t('replans')} tip={t('replan.tip')} /> <b>{progress?.replans ?? 0}</b></span>
        <span className={`${css.tally} ${faults > 0 ? css.tallyWarn : ''}`}>{t('faults')} <b>{faults}</b></span>
        {(progress?.task_errors ?? 0) > 0
          ? <span className={`${css.tally} ${css.tallyAlert}`}>{t('taskErrors')} <b>{progress?.task_errors}</b></span>
          : null}
      </div>
    </section>
  )
}

/** Runtime vitals: MODE badge, heartbeat age with a freshness dot, skills,
 * mount sha, viewfinder — each row led by its own glyph. */
function VitalsCard({
  boot, rtStatus, secs, online, t,
}: { boot?: BootRow | undefined; rtStatus: RuntimeStatus | null; secs: number | null; online: boolean | null } & { t: T }) {
  const sha = boot?.mount_plan_sha
  return (
    <section className={css.card}>
      <CardHead icon={<IconBroadcast size={14} />}>{t('card.vitals')}</CardHead>
      <VitalRow icon={<IconCpu size={13} />} label={t('mode')}>
        <span className={`${css.mode} ${boot?.mode === 'evolution' ? css.modeEvolution : boot?.mode === 'execution' ? css.modeExecution : css.modeUnknown}`}>
          {boot?.mode ?? t('modeUnknown')}
        </span>
      </VitalRow>
      <VitalRow icon={<IconActivity size={13} />} label={t('heartbeat')}>
        <span className={css.heartVal}>
          <span className={`${css.heartDot} ${heartCss[heartState(secs, online)]}`} />
          {secs === null ? '—' : `${formatAgo(secs)} ${t('ago')}`}
        </span>
      </VitalRow>
      <VitalRow icon={<IconBox size={13} />} label={t('skills')}>{boot?.skills_manifest?.length ?? 0}</VitalRow>
      {sha ? (
        <VitalRow icon={<IconSitemap size={13} />} label={<Term label={t('mountPlan')} tip={t('mountPlan.tip')} />}>
          <span className={css.mono}>{sha.slice(0, 8)}</span>
        </VitalRow>
      ) : null}
      <VitalRow icon={<IconViewfinder size={13} />} label={<Term label={t('viewfinder')} tip={t('viewfinder.tip')} />}>
        {rtStatus === null
          ? <span className={css.dim}>{online === false ? t('off') : '—'}</span>
          : (
            <span>
              {renderOn(rtStatus.render) ? t('on') : t('off')}
              {rtStatus.pid == null ? '' : <span className={css.mono}> {t('pid')} {rtStatus.pid}</span>}
            </span>
          )}
      </VitalRow>
    </section>
  )
}

/** Evolution ticker: the latest round as a feed item (round-number chip +
 * headline) over the newest campaign's promotion tally; each has a styled
 * empty state when the harness has none yet. */
function EvolutionCard({ stores, rounds, t }: { stores: StoreSummary[]; rounds: Round[] } & { t: T }) {
  const round = rounds[0]
  const store = stores[0]
  return (
    <section className={css.card}>
      <CardHead icon={<IconTrendingUp size={14} />}>{t('card.evolution')}</CardHead>
      {round
        ? (
          <div className={css.feedItem}>
            <span className={css.roundChip}>#{round.round}</span>
            <span className={css.feedTitle}>{round.title ?? ''}</span>
          </div>
        )
        : <div className={css.cardEmpty}>{t('noRounds')}</div>}
      {store
        ? (
          <div className={css.evoStore}>
            <span className={css.storeName}>{store.name ?? ''}</span>
            <span className={css.promoteBadge}>{store.promoted ?? 0}/{store.generations ?? 0} <Term label={t('promoted')} tip={t('promoted.tip')} /></span>
          </div>
        )
        : <div className={css.cardEmpty}>{t('noCampaign')}</div>}
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
