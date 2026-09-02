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
  BootRow, GpuVitals, Health, HostVitals, ModelServerState, PlanComplete, PolicyServerState,
  RuntimeEvent, RuntimeEventsPayload, RuntimeStatus, SessionDetail, SessionProgress, SessionSummary,
} from './types.ts'
import css from './ops.module.css'

/** The board reads the rail drives, injected by the slot registration. */
export interface RailInjected {
  fetchSessions: () => Promise<RemoteResult<unknown>>
  fetchSession: (name: string) => Promise<RemoteResult<unknown>>
  fetchSessionProgress: (name: string) => Promise<RemoteResult<unknown>>
  fetchRuntimeStatus: (name: string) => Promise<RemoteResult<unknown>>
  fetchRuntimeEvents: (name: string) => Promise<RemoteResult<unknown>>
  fetchStores: () => Promise<RemoteResult<unknown>>
  fetchRounds: () => Promise<RemoteResult<unknown>>
  fetchHostVitals: () => Promise<RemoteResult<unknown>>
  /** Read or switch the box's local model server. The action word is the only
   * argument the board takes, and the board whitelists it — the rail passes a
   * literal, never anything assembled here. */
  modelServer: (action: string) => Promise<RemoteResult<unknown>>
  /** Same contract one port over: the pi0.5 policy server. */
  policyServer: (action: string) => Promise<RemoteResult<unknown>>
  /** Restart the harness services; `build` rebuilds the console first. The
   * console goes down after answering, so the rail re-polls `fetchHealth`. */
  restartServices: (build: boolean) => Promise<RemoteResult<unknown>>
  /** Whole-pipeline health; the rail reads its `restart` row after a restart. */
  fetchHealth: () => Promise<RemoteResult<unknown>>
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
export function pickDefault(list: SessionSummary[]): string | null {
  return (list.find(s => s.kinds?.['runtime.boot'] !== undefined) ?? list[0])?.name ?? null
}
function renderOn(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return !['', 'off', 'none', 'false', '0'].includes(value.trim().toLowerCase())
  return value != null
}
/* jscpd:ignore-end */

/** Whether the newest run in the operational feed is still open: a `task_claimed`
 * with no following `task_done`/`task_failed`. The terminal markers are the
 * board's (harness.opstream), read verbatim — the same close rule as the
 * livegraph fold, so both surfaces call a run finished at the same event; this
 * only reads which of those markers is last, it computes no verdict. An empty or
 * absent feed reads as not-open (nothing running). */
function feedRunOpen(events: RuntimeEvent[]): boolean {
  let open = false
  for (const e of events) {
    if (e.kind === 'task_claimed') open = true
    else if (e.kind === 'task_done' || e.kind === 'task_failed') open = false
  }
  return open
}

/** Host-vitals refresh cadence. VRAM/RAM/disk move on their own — no board
 * write follows them — so the 15s evidence cadence would show a ceiling long
 * after it was hit. Still far slower than the event stream: these are slow
 * variables, and one nvidia-smi pair per tick is the whole cost. */
const VITALS_POLL_MS = 5000

/** A model-server click's optimistic window: the action is in flight and the
 * button is held down until a poll confirms the process actually changed. */
type PendingAction = 'start' | 'stop'

/** What the two switchable server states share. */
type ProcessState = ModelServerState | PolicyServerState

/** Whether an observed status ends {@link PendingAction}'s window. An `error`
 * ends it too — a launcher that could not run must hand the button back rather
 * than leave it disabled forever. */
function settled(pending: PendingAction, state: ProcessState): boolean {
  if (state.error !== undefined) return true
  return pending === 'start' ? state.running === true : state.running !== true
}

/** One switchable service process (the local model server, the pi0.5 policy
 * server): its last observed status on the vitals cadence — the process starts,
 * loads for a minute or two, and dies with no board write to follow — and a
 * click's optimistic window. The board owns the whitelist, the launcher path,
 * and the kill guard; `act` hands it a literal action word and holds the
 * button until a poll (or the reply) confirms the process actually changed.
 * A failed read folds to null, never flips the rail offline. */
function useProcessSwitch(
  call: (action: string) => Promise<RemoteResult<unknown>>,
): { state: ProcessState | null; pending: PendingAction | null; act: (action: PendingAction) => void } {
  const [state, setState] = useState<ProcessState | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const load = useCallback(async () => {
    try {
      const r = await call('status')
      const next = r.ok ? (r.value as ProcessState) : null
      setState(next)
      setPending(p => (p !== null && next !== null && settled(p, next) ? null : p))
    } catch {
      setState(null)
    }
  }, [call])
  const act = useCallback((action: PendingAction): void => {
    setPending(action)                          // out of reach for the whole round trip
    void (async () => {
      try {
        const r = await call(action)
        const next = r.ok ? (r.value as ProcessState) : null
        if (next === null) return               // keep the button held; the poll settles it
        setState(next)
        if (settled(action, next)) setPending(null)
      } catch {
        setPending(null)                        // assembly fault: hand the button back
      }
    })()
  }, [call])
  usePolledLoad(load, VITALS_POLL_MS)
  return { state, pending, act }
}

/** Restart control phases: `armed` is the in-widget second-click confirm (it
 * disarms itself after {@link ARM_MS}); `restarting` polls health until the
 * console answers again; `back` shows the restart row it answered with. */
type RestartPhase = 'idle' | 'armed' | 'restarting' | 'back'
const ARM_MS = 8000
/** ponytail: the helper answers BEFORE the console goes down, so the first
 * health poll waits out a grace window rather than reading the old process as
 * "back"; tune if the harness's restart takes longer to drop the port. */
const RESTART_GRACE_MS = 4000
const RESTART_POLL_MS = 2000

export function OperatorRail({
  wide, fetchSessions, fetchSession, fetchSessionProgress, fetchRuntimeStatus, fetchRuntimeEvents,
  fetchStores, fetchRounds, fetchHostVitals, modelServer, policyServer, restartServices, fetchHealth, t,
}: SidebarSectionProps & InjectFace<RailInjected> & PropsLocale<'phops'>) {
  const [latest, setLatest] = useState<SessionSummary | null>(null)
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [progress, setProgress] = useState<SessionProgress | null>(null)
  const [rtStatus, setRtStatus] = useState<RuntimeStatus | null>(null)
  const [running, setRunning] = useState(false)
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [online, setOnline] = useState<boolean | null>(null)
  const [host, setHost] = useState<HostVitals | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const model = useProcessSwitch(modelServer)
  const policy = useProcessSwitch(policyServer)
  const [restart, setRestart] = useState<RestartPhase>('idle')
  const [build, setBuild] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)

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
      const [d, p, r, ev, st, rd] = await Promise.all([
        fetchSession(top.name), fetchSessionProgress(top.name), fetchRuntimeStatus(top.name),
        fetchRuntimeEvents(top.name), fetchStores(), fetchRounds(),
      ])
      if (d.ok) setDetail(d.value as SessionDetail)
      if (p.ok) setProgress(p.value as SessionProgress)
      setRtStatus(r.ok ? ((r.value as RuntimeStatus | null) ?? null) : null)
      if (ev.ok) setRunning(feedRunOpen((ev.value as RuntimeEventsPayload | null)?.events ?? []))
      if (st.ok) setStores(st.value as StoreSummary[])
      if (rd.ok) setRounds(rd.value as Round[])
    } catch {
      // A board read folds carrier failures into `ok: false`, but assembly
      // faults (arg/codec/Context) reject; a rejected poll must read as board
      // offline, never leave the rail stuck on 模式 未知 / 技能 0. The next
      // healthy poll sets online + detail again, so the cards return to live.
      setOnline(false)
    }
  }, [fetchSessions, fetchSession, fetchSessionProgress, fetchRuntimeStatus, fetchRuntimeEvents, fetchStores, fetchRounds])

  // Host vitals ride their own faster cadence and their own failure: a board
  // that cannot answer them still leaves the mission cards live, so a failed
  // read clears only this row set rather than flipping the rail offline.
  const loadHost = useCallback(async () => {
    try {
      const v = await fetchHostVitals()
      setHost(v.ok ? (v.value as HostVitals) : null)
    } catch {
      setHost(null)
    }
  }, [fetchHostVitals])

  // Switching the model SERVICE PROCESS: the direction comes from the last
  // observed status and the action word is a literal.
  const toggleModel = useCallback((): void => {
    model.act(model.state?.running === true ? 'stop' : 'start')
  }, [model])

  // Restart: first click arms, second click (within ARM_MS, same widget) fires.
  // The reply is not awaited for state — the console is about to go down — the
  // health poll below is what ends the restarting phase.
  const clickRestart = useCallback((): void => {
    if (restart !== 'armed') { setRestart('armed'); return }
    setRestart('restarting')
    setHealth(null)
    void restartServices(build).catch(() => {})
  }, [restart, build, restartServices])
  useEffect(() => {
    if (restart === 'armed') {
      const timer = setTimeout(() => { setRestart('idle') }, ARM_MS)
      return () => { clearTimeout(timer) }
    }
    if (restart !== 'restarting') return
    let live = true
    const tick = async () => {
      try {
        const r = await fetchHealth()
        if (live && r.ok) { setHealth(r.value as Health); setRestart('back') }
      } catch { /* console still down: keep polling */ }
    }
    let timer: ReturnType<typeof setInterval> | undefined
    const grace = setTimeout(() => { void tick(); timer = setInterval(() => { void tick() }, RESTART_POLL_MS) }, RESTART_GRACE_MS)
    return () => { live = false; clearTimeout(grace); if (timer !== undefined) clearInterval(timer) }
  }, [restart, fetchHealth])

  usePolledLoad(load)
  usePolledLoad(loadHost, VITALS_POLL_MS)
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
      <MissionCard runs={runs} progress={progress} running={running} t={t} />
      <ProgressCard progress={progress} t={t} />
      <VitalsCard
        boot={boot} rtStatus={rtStatus} host={host} secs={secs} online={online}
        model={model.state} pending={model.pending} onToggleModel={toggleModel}
        policy={policy.state} policyPending={policy.pending} onPolicy={policy.act}
        restart={restart} build={build} onBuild={setBuild} onRestart={clickRestart} health={health} t={t}
      />
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

/** How long the 收场 final line lingers before the mission card yields to idle.
 * ponytail: fixed dwell — expose as config only if an operator asks for it. */
const SETTLE_MS = 30000

/** Mission mini-map: a status-dot title, the run-outcome strip, then the latest
 * task's node chips — each a colored state glyph + name + a `N/total` stage
 * badge; clicking a chip expands its stage strip in place. Chips group by
 * verdict (fail › pending › pass) so trouble surfaces first: the fold delivers
 * the node map name-sorted, not in execution order. Far-LOD sibling of 执行图谱. */
function MissionCard({
  runs, progress, running, t,
}: { runs: PlanComplete[]; progress: SessionProgress | null; running: boolean } & { t: T }) {
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
  // 收场: once the feed's run is no longer open (a terminal marker was last), the
  // live dot strip + chips give way to a compact final line, which then yields to
  // idle after a dwell. A fresh claim (running) or a new sealed run (runs.length)
  // re-reveals it. Reading which terminal marker is last is the board's call, not
  // a computed verdict here.
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    setDismissed(false)
    if (running || runs.length === 0) return
    const id = setTimeout(() => { setDismissed(true) }, SETTLE_MS)
    return () => { clearTimeout(id) }
  }, [running, runs.length])
  if (runs.length !== 0 && !running) {
    return (
      <section className={css.card}>
        <CardHead icon={<IconRoute size={14} />}>{t('card.mission')}</CardHead>
        {dismissed ? <div className={css.cardEmpty}>{t('idle')}</div> : <MissionSettled latest={latest} t={t} />}
      </section>
    )
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
                <span className={css.goalText} title={latest.goal}>{latest.goal}</span>
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

/** The 收场 final line for a settled run: a verdict glyph + verdict word, the
 * goal (hover for the full string), and the node pass count — every field read
 * verbatim from the sealed latest run (its `success` and node map). */
function MissionSettled({ latest, t }: { latest: PlanComplete | null } & { t: T }) {
  const st = phState(latest?.success)
  const entries = Object.values(latest?.nodes ?? {})
  const pass = entries.filter(n => n.success === true).length
  const verdict = latest?.success === true ? t('success') : latest?.success === false ? t('failure') : t('settled')
  return (
    <div className={`${css.settled} ${stCss[st]}`}>
      <span className={css.settledGlyph}>{stGlyph[st]}</span>
      <div className={css.settledBody}>
        <span className={css.settledVerdict}>{verdict}</span>
        {latest?.goal ? <span className={css.settledMeta} title={latest.goal}>{latest.goal}</span> : null}
        <span className={css.settledMeta}>{pass}/{entries.length} {t('nodesPassed')}</span>
      </div>
    </div>
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

/** How full a resource may run before the meter warns. The operator's whole
 * reason for this row set is seeing a ceiling BEFORE it kills a resident
 * runtime, so amber leaves room to act and red means act now. Presentation
 * only — the numbers are the board's; TS picks a colour, never a value.
 * ponytail: fixed cutoffs, expose as config if a deployment wants its own. */
const RES_AMBER = 0.75
const RES_RED = 0.9
const resCss = (frac: number | null): string =>
  (frac === null ? css.meterNone ?? ''
    : frac >= RES_RED ? css.meterFail ?? ''
      : frac >= RES_AMBER ? css.meterAmber ?? '' : css.meterPass ?? '')

/** One resource meter: label + used-of-total on the left/right of a filled
 * track, with an optional detail line under it (the process holding the VRAM).
 * `used`/`total` arrive from the board already in their display unit. */
function ResourceMeter({
  label, used, total, unit, value, detail,
}: {
  label: ReactNode
  used: number | null
  total: number | null
  unit: string
  value?: string | undefined
  detail?: string | null | undefined
}) {
  const frac = used === null || total === null || total <= 0 ? null : Math.min(used / total, 1)
  return (
    <div className={css.resMeter}>
      <div className={css.meterLabel}>
        <span>{label}</span>
        <b className={frac !== null && frac >= RES_RED ? css.resAlert : undefined}>
          {frac === null ? '—' : (value ?? `${used} / ${total} ${unit}`)}
          {frac === null ? '' : ` · ${Math.round(frac * 100)}%`}
        </b>
      </div>
      <div className={css.meterTrack}>
        <span className={`${css.meterFill} ${resCss(frac)}`} style={{ width: `${(frac ?? 0) * 100}%` }} />
      </div>
      {detail ? <div className={css.resDetail} title={detail}>{detail}</div> : null}
    </div>
  )
}

/** One GPU's VRAM meter, labelled with its index only when the box has more
 * than one card. The top consumer is `procs[0]` — the board ranks them. */
function GpuMeter({ gpu, multi, t }: { gpu: GpuVitals; multi: boolean } & { t: T }) {
  const top = gpu.procs?.[0]
  return (
    <ResourceMeter
      label={<Term label={multi ? `${t('vram')} ${gpu.index ?? '?'}` : t('vram')} tip={t('vram.tip')} />}
      used={finite(gpu.used_mib)}
      total={finite(gpu.total_mib)}
      unit="MiB"
      detail={top?.name === undefined ? null : `${top.name} · ${top.used_mib ?? 0} MiB`}
    />
  )
}

/** The badge a model-server status paints, and the hue each phase reads.
 * `loading` covers both halves of the wait the operator actually sees: the
 * board reporting a process that holds its port without answering yet, and the
 * in-flight click before any poll has come back. */
const MODEL_PHASE = {
  off: { key: 'model.off', css: css.stPend },
  loading: { key: 'model.loading', css: css.stAmber },
  stopping: { key: 'model.stopping', css: css.stAmber },
  on: { key: 'model.on', css: css.stPass },
} as const

/** The local model server: a state badge and the one button that switches it.
 * Presentation only — the phase is read off the board's `running`/`healthy`,
 * and the click hands back a fixed action word.
 * @param state - the board's last `modelServer` status, null while unreachable.
 * @param pending - an action in flight; holds the button and the badge.
 * @param onToggle - runs the action the current state implies.
 */
function ModelServerRow({
  state, pending, onToggle, t,
}: {
  state: ModelServerState | null
  pending: PendingAction | null
  onToggle: () => void
} & { t: T }) {
  const running = state?.running === true
  const phase = pending === 'stop' ? 'stopping'
    : pending === 'start' || (running && state.healthy !== true) ? 'loading'
      : running ? 'on' : 'off'
  const badge = MODEL_PHASE[phase]
  return (
    <div className={css.resMeter}>
      <div className={css.meterLabel}>
        <span><Term label={t('modelServer')} tip={t('modelServer.tip')} /></span>
        <span className={`${css.modelBadge} ${badge.css ?? ''}`}>{t(badge.key)}</span>
      </div>
      <div className={css.modelLine}>
        <button
          type="button" className={css.modelBtn} onClick={onToggle}
          disabled={pending !== null || state === null}
          title={state?.model ?? undefined}
        >
          {running ? t('modelStop') : t('modelStart')}
        </button>
        {state?.vram_mib == null ? null : <span className={css.resDetail}>{state.vram_mib} MiB</span>}
      </div>
      {/* The control is a process switch, not a route switch, and an operator
          who reads it the other way stops the server expecting a model swap. */}
      <div className={css.modelNote}>{t('modelServer.note')}</div>
      {state?.error === undefined
        ? null
        : <div className={css.resDetail} title={state.error}>{state.error}</div>}
    </div>
  )
}

/** The pi0.5 policy server: badge (stopped / running-not-serving / serving),
 * the checkpoint sha it loaded, and explicit Start / Stop buttons — explicit
 * because it is NOT started by default and holds ~18 GB VRAM the local model
 * also needs; the note says so under the buttons. */
function PolicyServerRow({
  state, pending, onAct, t,
}: {
  state: PolicyServerState | null
  pending: PendingAction | null
  onAct: (action: PendingAction) => void
} & { t: T }) {
  const running = state?.running === true
  const badge = pending === 'stop' ? { key: 'model.stopping', css: css.stAmber } as const
    : pending === 'start' || (running && state.serving !== true) ? { key: 'policy.running', css: css.stAmber } as const
      : running ? { key: 'policy.serving', css: css.stPass } as const
        : { key: 'policy.off', css: css.stPend } as const
  const held = pending !== null || state === null
  return (
    <div className={css.resMeter}>
      <div className={css.meterLabel}>
        <span><Term label={t('policyServer')} tip={t('policyServer.tip')} /></span>
        <span className={`${css.modelBadge} ${badge.css ?? ''}`}>{t(badge.key)}</span>
      </div>
      <div className={css.modelLine}>
        <span>
          <button type="button" className={css.modelBtn} onClick={() => { onAct('start') }} disabled={held || running}>
            {t('policyStart')}
          </button>
          {' '}
          <button type="button" className={css.modelBtn} onClick={() => { onAct('stop') }} disabled={held || !running}>
            {t('policyStop')}
          </button>
        </span>
        {state?.checkpoint_sha == null
          ? null
          : <span className={css.resDetail} title={state.checkpoint_sha}>{state.checkpoint_sha.slice(0, 8)}</span>}
      </div>
      <div className={css.modelNote}>{t('policyServer.note')}</div>
      {state?.error === undefined
        ? null
        : <div className={css.resDetail} title={state.error}>{state.error}</div>}
    </div>
  )
}

/** Restart services: one button that arms on the first click and fires on the
 * second (the whole confirm lives in this widget — no window.confirm), a
 * rebuild-first checkbox, then the restarting line until health answers again
 * and the restart row it answered with. */
function RestartControl({
  phase, build, onBuild, onClick, health, t,
}: {
  phase: RestartPhase
  build: boolean
  onBuild: (build: boolean) => void
  onClick: () => void
  health: Health | null
} & { t: T }) {
  const restarting = phase === 'restarting'
  const last = health?.restart
  return (
    <div className={css.resMeter}>
      <div className={css.modelLine}>
        <button type="button" className={css.modelBtn} onClick={onClick} disabled={restarting}>
          {phase === 'armed' ? t('restart.confirm') : t('restart')}
        </button>
        <label className={css.modelNote}>
          <input type="checkbox" checked={build} disabled={restarting} onChange={(e) => { onBuild(e.target.checked) }} />
          {' '}{t('restart.build')}
        </label>
      </div>
      {restarting ? <div className={css.resDetail}>{t('restart.restarting')}</div> : null}
      {phase === 'back' && last !== undefined
        ? <div className={css.resDetail} title={last.last ?? undefined}>{t('restart.last')}: {last.state ?? '?'} · {last.last ?? ''}</div>
        : null}
    </div>
  )
}

/** Runtime vitals: MODE badge, heartbeat age with a freshness dot, skills,
 * mount sha, viewfinder — each row led by its own glyph — then the host's own
 * headroom (VRAM per card, RAM, free disk) as warning-coloured meters, with the
 * local model server's switch under the VRAM meter that explains why it is
 * there. The switch keeps its own row set: a hostVitals outage must not take
 * away the operator's only way to free the card. */
function VitalsCard({
  boot, rtStatus, host, secs, online, model, pending, onToggleModel,
  policy, policyPending, onPolicy, restart, build, onBuild, onRestart, health, t,
}: {
  boot?: BootRow | undefined
  rtStatus: RuntimeStatus | null
  host: HostVitals | null
  secs: number | null
  online: boolean | null
  model: ModelServerState | null
  pending: PendingAction | null
  onToggleModel: () => void
  policy: PolicyServerState | null
  policyPending: PendingAction | null
  onPolicy: (action: PendingAction) => void
  restart: RestartPhase
  build: boolean
  onBuild: (build: boolean) => void
  onRestart: () => void
  health: Health | null
} & { t: T }) {
  const sha = boot?.mount_plan_sha
  const gpus = host?.gpu ?? []
  const diskFree = finite(host?.disk?.free_gb)
  const diskTotal = finite(host?.disk?.total_gb)
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
      {host === null
        ? null
        : gpus.length === 0
          ? <div className={css.cardEmpty}>{t('noGpu')}</div>
          : gpus.map((g, i) => <GpuMeter key={g.index ?? i} gpu={g} multi={gpus.length > 1} t={t} />)}
      <ModelServerRow state={model} pending={pending} onToggle={onToggleModel} t={t} />
      <PolicyServerRow state={policy} pending={policyPending} onAct={onPolicy} t={t} />
      <RestartControl phase={restart} build={build} onBuild={onBuild} onClick={onRestart} health={health} t={t} />
      {host === null
        ? null
        : (
          <>
            <ResourceMeter
              label={t('ram')} unit="GB"
              used={finite(host.ram?.used_gb)} total={finite(host.ram?.total_gb)}
            />
            {/* Disk fills bottom-up, so the meter tracks USED while the number
                the operator acts on is the free space left. */}
            <ResourceMeter
              label={t('disk')} unit="GB"
              used={diskFree === null || diskTotal === null ? null : diskTotal - diskFree}
              total={diskTotal}
              value={diskFree === null ? undefined : `${diskFree} GB ${t('diskFree')}`}
            />
          </>
        )}
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
            <span className={css.feedTitle} title={round.title ?? ''}>{round.title ?? ''}</span>
          </div>
        )
        : <div className={css.cardEmpty}>{t('noRounds')}</div>}
      {store
        ? (
          <div className={css.evoStore}>
            <span className={css.storeName} title={store.name ?? ''}>{store.name ?? ''}</span>
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
