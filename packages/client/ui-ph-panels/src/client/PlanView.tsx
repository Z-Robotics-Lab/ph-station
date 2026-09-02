/** 规划 view: a natural-language task box over the harness's skill-graph planner.
 * Plan → the board Remote `planSkillTask` (harness: graph retrieval → DeepSeek
 * strict JSON → validate_plan → server-side expansion → binding check) and this
 * view renders the returned dicts verbatim: the composite plan, the expanded leaf
 * chain, per-leaf taxonomy path and binding state, the status verdict, and the
 * missing bindings. Execute is enabled only when the harness said
 * `executable: true`; it calls `submitSkillPlan` with the record the harness
 * handed back and then polls `briefStatus`. Renders only: every verdict, every
 * label, and every refusal is computed harness-side. Model text is rendered as
 * React text nodes, never as HTML. */

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { PhPanelsKey } from './locales.ts'
import { EmptyCard, PanelFrame } from './chrome.tsx'
import css from './panels.module.css'

/** The board calls this view drives, injected by the slot registration. */
export interface PlanInjected {
  planSkillTask: (instruction: string, session: string, seed: number) => Promise<RemoteResult<unknown>>
  submitSkillPlan: (plan: string, session: string, seed: number) => Promise<RemoteResult<unknown>>
  briefStatus: (briefId: string, session: string) => Promise<RemoteResult<unknown>>
  cancelBrief: (briefId: string, session: string) => Promise<RemoteResult<unknown>>
}

// Presentation shapes over board.planning JSON (the subset rendered).
interface PlanNode { id?: string; skill?: string; kind?: string; args?: Record<string, unknown>; after?: string[] }
interface PlanRecord { plan_id?: string | null; channel?: string; task?: string | null; plan?: { goal?: string; nodes?: PlanNode[] } }
interface LeafRow {
  node?: string
  label?: string
  skill?: string
  stage?: string | null
  canonical?: string | null
  args?: Record<string, unknown>
  after?: string[]
  taxonomy_path?: string[]
  bound?: boolean
  binding?: { task?: string; policy?: string; task_template?: string | null } | null
  reason?: string | null
}
interface ExpandedNode {
  id?: string
  skill?: string
  taxonomy_path?: string[]
  decomposition?: { skill?: string; bound?: boolean }[]
  leaves?: string[]
  bound?: boolean
}
interface Expanded { nodes?: ExpandedNode[]; chain?: LeafRow[]; terminal?: string }
interface Missing { label?: string; reason?: string | null }
interface Channel { id?: string; kind?: string; task?: string | null; score?: number; matched?: string[] }
interface Catalogue { size?: number; graph_total_skills?: number; skills?: { name?: string; bound?: boolean }[] }
/** One `plan_skill_task` reply (board.planning). `error` is the pre-model refusal form. */
export interface PlanResult {
  status?: string
  goal?: string | null
  error?: string
  executable?: boolean
  channel?: Channel
  selected_catalogue?: Catalogue | null
  composite_plan?: PlanRecord | null
  expanded_plan?: Expanded | null
  missing_bindings?: Missing[]
  unbound_oracles?: string[]
  validation?: { ok?: boolean; message?: string }
}
/** One `submit_skill_plan` / `brief_status` reply. */
interface BriefHandle {
  submitted?: boolean
  error?: string
  status?: string
  brief_id?: string
  state?: string
  queue_position?: number
  running_s?: number
  execution_note?: string
}

/** Statuses the harness reports, as locale keys; an unknown status renders raw. */
const STATUS_KEYS = new Set<PhPanelsKey>([
  'plan.status.executable', 'plan.status.planning_only', 'plan.status.rejected', 'plan.status.no_match',
])
/** Brief states that are still moving (poll cadence stays armed). */
const LIVE_STATES = new Set(['queued', 'running'])
/** brief_status poll cadence while a submitted brief is live: task cadence, not frame cadence. */
const BRIEF_POLL_MS = 2000
const DEFAULT_SEED = 424242

interface SimulatorOption { id: string; label: string; session: string }
const ROBOCASA_SIMULATOR: SimulatorOption = { id: 'robocasa', label: 'RoboCasa', session: 'session-robocasa' }
const SIMULATORS: readonly SimulatorOption[] = [ROBOCASA_SIMULATOR]

const argValue = (value: unknown): string => {
  if (value === null) return '—'
  if (Array.isArray(value)) return value.map(argValue).join(', ')
  if (typeof value === 'object') return Object.entries(value).map(([key, child]) => `${key}=${argValue(child)}`).join(', ')
  if (typeof value === 'function') return value.name || '—'
  if (typeof value === 'undefined') return '—'
  if (typeof value === 'symbol') return value.description ?? '—'
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return `${value}`
  if (typeof value === 'bigint') return `${value}`
  return '—'
}

export function PlanView({
  planSkillTask, submitSkillPlan, briefStatus, cancelBrief, t,
}: ConvViewProps & InjectFace<PlanInjected> & PropsLocale<'phpanels'>) {
  const [instruction, setInstruction] = useState('')
  const [simulatorId, setSimulatorId] = useState('robocasa')
  const [seed, setSeed] = useState(String(DEFAULT_SEED))
  const [phase, setPhase] = useState<'idle' | 'planning' | 'planned' | 'error'>('idle')
  const [result, setResult] = useState<PlanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [handle, setHandle] = useState<BriefHandle | null>(null)
  const live = useRef(true)
  useEffect(() => () => { live.current = false }, [])

  const simulator = SIMULATORS.find(candidate => candidate.id === simulatorId) ?? ROBOCASA_SIMULATOR
  const session = simulator.session
  const seedNumber = Number.parseInt(seed, 10)
  const seedOk = Number.isFinite(seedNumber)

  const plan = useCallback(async (event?: FormEvent) => {
    event?.preventDefault()
    const text = instruction.trim()
    if (text === '' || !seedOk) return
    setPhase('planning'); setError(null); setResult(null); setHandle(null)
    try {
      const r = await planSkillTask(text, session, seedNumber)
      if (!live.current) return
      if (!r.ok) { setError(r.error.message); setPhase('error'); return }
      const value = r.value as PlanResult
      if (value.error !== undefined && value.status !== 'rejected') {
        setError(value.error); setPhase('error'); return
      }
      setResult(value); setPhase('planned')
    } catch (cause) {
      if (!live.current) return
      setError(cause instanceof Error ? cause.message : String(cause)); setPhase('error')
    }
  }, [instruction, session, seedNumber, seedOk, planSkillTask])

  const execute = useCallback(async () => {
    const record = result?.composite_plan
    if (result?.executable !== true || record === null || record === undefined) return
    setSubmitting(true); setHandle(null)
    try {
      const r = await submitSkillPlan(JSON.stringify(record), session, seedNumber)
      if (!live.current) return
      if (!r.ok) { setHandle({ submitted: false, error: r.error.message }); return }
      setHandle(r.value as BriefHandle)
    } catch (cause) {
      if (live.current) setHandle({ submitted: false, error: cause instanceof Error ? cause.message : String(cause) })
    } finally {
      if (live.current) setSubmitting(false)
    }
  }, [result, session, seedNumber, submitSkillPlan])

  // Poll the brief while it is queued/running; the harness's brief_status is the
  // one reader of a brief's fate (never reconstructed here).
  const briefId = handle?.submitted === true ? handle.brief_id : undefined
  const state = handle?.state
  useEffect(() => {
    if (briefId === undefined || state === undefined || !LIVE_STATES.has(state)) return
    const tick = async () => {
      if (document.hidden) return
      try {
        const r = await briefStatus(briefId, session)
        if (live.current && r.ok) setHandle(prev => ({ ...(prev ?? {}), ...(r.value as BriefHandle), submitted: true }))
      } catch {
        // keep the last handle; the next tick retries
      }
    }
    const timer = setInterval(() => { void tick() }, BRIEF_POLL_MS)
    return () => { clearInterval(timer) }
  }, [briefId, state, session, briefStatus])

  const cancel = useCallback(async () => {
    if (briefId === undefined) return
    try {
      const r = await cancelBrief(briefId, session)
      if (live.current && r.ok) {
        const v = r.value as { error?: string; state?: string }
        setHandle((prev) => {
          const base: BriefHandle = prev ?? {}
          if (v.error !== undefined) return { ...base, error: v.error }
          return v.state === undefined ? base : { ...base, state: v.state }
        })
      }
    } catch {
      // a failed cancel leaves the handle as is; the operator can retry
    }
  }, [briefId, session, cancelBrief])

  const statusKey = `plan.status.${result?.status ?? ''}` as PhPanelsKey
  const statusLabel = result?.status === undefined
    ? null
    : (STATUS_KEYS.has(statusKey) ? t(statusKey) : result.status)
  const statusClass = result?.status === 'executable'
    ? css.planStatusExecutable
    : result?.status === 'planning_only' ? css.planStatusPlanningOnly : css.planStatusRejected
  const canExecute = phase === 'planned' && result?.executable === true && !submitting && handle?.submitted !== true

  return (
    <PanelFrame title={t('view.plan')} sub={t('sub.plan')}>
      <form className={css.planForm} onSubmit={(e) => { void plan(e) }}>
        <label className={css.planLabel}>
          <span>{t('plan.instructionLabel')}</span>
          <input
            className={css.planInput}
            value={instruction}
            placeholder={t('plan.placeholder')}
            aria-label={t('plan.instructionLabel')}
            onChange={(e) => { setInstruction(e.target.value) }}
            disabled={phase === 'planning'}
          />
        </label>
        <label className={css.planLabelSimulator}>
          <span>{t('plan.simulator')}</span>
          <select
            className={css.planSelect}
            value={simulatorId}
            aria-label={t('plan.simulator')}
            onChange={(e) => { setSimulatorId(e.target.value) }}
            disabled={phase === 'planning'}
          >
            {SIMULATORS.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
          </select>
          <span className={css.planAvailable}>{t('plan.simulatorAvailable')}</span>
        </label>
        <label className={css.planLabelSmall}>
          <span>{t('plan.seed')}</span>
          <input className={css.planInputSmall} value={seed} aria-label={t('plan.seed')} onChange={(e) => { setSeed(e.target.value) }} />
        </label>
        <button type="submit" className={css.planBtn} disabled={phase === 'planning' || instruction.trim() === '' || !seedOk}>
          {phase === 'planning' ? t('plan.planning') : t('plan.plan')}
        </button>
        <button type="button" className={`${css.planBtn} ${css.planBtnExecute}`} disabled={!canExecute} onClick={() => { void execute() }}>
          {submitting ? t('plan.submitting') : t('plan.execute')}
        </button>
      </form>

      {phase === 'idle' ? <EmptyCard>{t('plan.empty')}</EmptyCard> : null}
      {phase === 'planning' ? <div className={css.state}>{t('plan.planning')}</div> : null}
      {phase === 'error' ? <div className={`${css.state} ${css.planError}`}>{t('plan.error')} — {error}</div> : null}

      {phase === 'planned' && result !== null ? (
        <div className={css.planBody}>
          <div className={css.planVerdict}>
            <span className={`${css.planStatus} ${statusClass}`}>{statusLabel}</span>
            {result.goal ? <span className={css.planGoal}>{result.goal}</span> : null}
            {result.channel ? (
              <span className={css.planMeta}>
                {t('plan.channel')} {result.channel.id ?? '—'} · {result.channel.kind ?? '—'}
                {result.channel.matched && result.channel.matched.length > 0 ? ` · ${t('plan.matched')} ${result.channel.matched.join(', ')}` : ''}
              </span>
            ) : null}
            {result.selected_catalogue ? (
              <span className={css.planMeta}>
                {t('plan.catalogue')} {result.selected_catalogue.size ?? '—'} / {result.selected_catalogue.graph_total_skills ?? '—'}
              </span>
            ) : null}
          </div>

          {result.validation?.ok === false ? (
            <div className={`${css.state} ${css.planError}`}>{t('plan.validation')} — {result.validation.message ?? ''}</div>
          ) : null}

          {result.executable === true ? null : result.status === 'planning_only' ? (
            <div className={css.planNotice}>{t('plan.planningOnlyNotice')}</div>
          ) : null}

          {result.composite_plan?.plan?.nodes && result.composite_plan.plan.nodes.length > 0
            ? <SkillPlanGraph result={result} simulator={simulator.label} t={t} />
            : null}

          {result.missing_bindings && result.missing_bindings.length > 0 ? (
            <>
              <div className={css.sectionHead}>{t('plan.missing')} ({result.missing_bindings.length})</div>
              <ul className={css.planList}>
                {result.missing_bindings.map((m, i) => (
                  <li key={m.label ?? i} className={css.planListRow}>
                    <span className={`${css.planChip} ${css.planChipUnbound}`}>{t('plan.unbound')}</span>
                    <span className={css.planSkill}>{m.label ?? '—'}</span>
                    <span className={css.planMeta}>{m.reason ?? ''}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {result.unbound_oracles && result.unbound_oracles.length > 0 ? (
            <div className={css.planMeta}>{t('plan.unboundOracles')} {result.unbound_oracles.join(', ')}</div>
          ) : null}

          {handle !== null ? <Handle handle={handle} onCancel={() => { void cancel() }} t={t} /> : null}
        </div>
      ) : null}
    </PanelFrame>
  )
}

function Kv({ k, children }: { k: string; children: ReactNode }) {
  return <span className={css.planKv}><span className={css.planKey}>{k}</span> {children}</span>
}

function Args({ args, t }: { args?: Record<string, unknown> | undefined } & PropsLocale<'phpanels'>) {
  const entries = Object.entries(args ?? {})
  if (entries.length === 0) return null
  return (
    <div className={css.planGraphArgs} aria-label={t('plan.node.args')}>
      {entries.map(([key, value]) => (
        <span key={key} className={css.planArg}><span>{key}</span>{argValue(value)}</span>
      ))}
    </div>
  )
}

function SkillPlanGraph({ result, simulator, t }: { result: PlanResult; simulator: string } & PropsLocale<'phpanels'>) {
  const compositeNodes = result.composite_plan?.plan?.nodes ?? []
  const expandedNodes = result.expanded_plan?.nodes ?? []
  const chain = result.expanded_plan?.chain ?? []
  const allBound = chain.length > 0 && chain.every(row => row.bound === true)

  return (
    <section className={css.planGraph} aria-label={t('plan.graph')}>
      <div className={css.planGraphHead}>
        <div>
          <div className={css.planGraphEyebrow}>{t('plan.generatedGraph')}</div>
          <div className={css.planGraphTitle}>{result.goal ?? result.composite_plan?.plan?.goal ?? '—'}</div>
        </div>
        <div className={css.planGraphSummary}>
          <span>{simulator}</span>
          <span>{compositeNodes.length} {t('plan.compositeCount')}</span>
          <span>{chain.length} {t('plan.leafCount')}</span>
        </div>
      </div>

      <div className={css.planGraphScroller}>
        <div className={css.planGraphFlow} role="list" aria-label={t('plan.graphFlow')}>
          <div className={`${css.planGraphNode} ${css.planGraphGoal}`}>
            <span className={css.planGraphNodeKind}>{t('plan.goal')}</span>
            <strong>{result.goal ?? t('plan.task')}</strong>
          </div>

          {compositeNodes.map((node, index) => {
            const expanded = expandedNodes.find(candidate => candidate.id === node.id)
            const leafNames = new Set(expanded?.leaves ?? [])
            const leaves = chain.filter(row => row.node === node.id || (row.label !== undefined && leafNames.has(row.label)))
            return (
              <Fragment key={node.id ?? index}>
                <GraphArrow label={node.after && node.after.length > 1 ? node.after.join(' + ') : undefined} />
                <article className={css.planGraphCluster} role="listitem">
                  <div className={css.planGraphClusterHead}>
                    <span className={css.planGraphIndex}>{String(index + 1).padStart(2, '0')}</span>
                    <div className={css.planGraphClusterIdentity}>
                      <span className={css.planGraphNodeKind}>{node.kind ?? t('plan.compositeSkill')}</span>
                      <strong>{node.skill ?? '—'}</strong>
                    </div>
                    <span className={`${css.planGraphDot} ${expanded?.bound === true ? css.planGraphDotBound : css.planGraphDotUnbound}`} aria-hidden="true" />
                  </div>
                  {expanded?.taxonomy_path && expanded.taxonomy_path.length > 0
                    ? <div className={css.planGraphPath}>{expanded.taxonomy_path.join(' › ')}</div>
                    : null}
                  <Args args={node.args} t={t} />
                  {leaves.length > 0 ? (
                    <div className={css.planGraphLeaves}>
                      <span className={css.planGraphBranch} aria-hidden="true" />
                      {leaves.map((leaf, leafIndex) => (
                        <Fragment key={leaf.label ?? leafIndex}>
                          {leafIndex > 0 ? <span className={css.planGraphLeafArrow} aria-hidden="true">↓</span> : null}
                          <div className={css.planGraphLeaf}>
                            <div className={css.planGraphLeafHead}>
                              <span>{leaf.label ?? leaf.skill ?? '—'}</span>
                              <span className={`${css.planChip} ${leaf.bound === true ? css.planChipBound : css.planChipUnbound}`}>
                                {leaf.bound === true ? t('plan.bound') : t('plan.unbound')}
                              </span>
                            </div>
                            <div className={css.planGraphCanonical}>
                              <span>{leaf.stage ?? '—'} → {leaf.canonical ?? leaf.skill ?? '—'}</span>
                              {leaf.binding?.task ? <span>· {leaf.binding.task}</span> : null}
                            </div>
                            <Args args={leaf.args} t={t} />
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  ) : null}
                </article>
              </Fragment>
            )
          })}

          <GraphArrow />
          <div className={`${css.planGraphNode} ${css.planGraphDone}`}>
            <span className={css.planGraphNodeKind}>{t('plan.terminal')}</span>
            <strong>{result.expanded_plan?.terminal ?? 'done'}</strong>
            <span className={`${css.planGraphDot} ${allBound ? css.planGraphDotBound : css.planGraphDotUnbound}`} aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className={css.planGraphLegend}>
        <span><i className={`${css.planGraphDot} ${css.planGraphDotBound}`} />{t('plan.bound')}</span>
        <span><i className={`${css.planGraphDot} ${css.planGraphDotUnbound}`} />{t('plan.unbound')}</span>
        <span>{t('plan.graphHint')}</span>
      </div>
    </section>
  )
}

function GraphArrow({ label }: { label?: string | undefined }) {
  return (
    <div className={css.planGraphArrow} aria-hidden="true">
      {label ? <span>{label}</span> : null}
      <i />
    </div>
  )
}

function Handle({ handle, onCancel, t }: { handle: BriefHandle; onCancel: () => void } & PropsLocale<'phpanels'>) {
  if (handle.submitted !== true) {
    return <div className={`${css.state} ${css.planError}`}>{t('plan.submitRefused')} — {handle.error ?? handle.status ?? ''}</div>
  }
  const stateKey = `plan.brief.${handle.state ?? ''}` as PhPanelsKey
  const known = new Set<PhPanelsKey>(['plan.brief.queued', 'plan.brief.running', 'plan.brief.stalled', 'plan.brief.done', 'plan.brief.failed', 'plan.brief.cancelled'])
  const stateLabel = handle.state === undefined ? '—' : (known.has(stateKey) ? t(stateKey) : handle.state)
  const liveNow = handle.state !== undefined && LIVE_STATES.has(handle.state)
  return (
    <div className={css.planHandle}>
      <div className={css.sectionHead}>{t('plan.brief')}</div>
      <div className={css.planLeafBody}>
        <Kv k={t('plan.briefId')}><span className={css.planMono}>{handle.brief_id ?? '—'}</span></Kv>
        <Kv k={t('plan.briefState')}><span className={`${css.planChip} ${liveNow ? css.planChipLive : ''}`}>{stateLabel}</span></Kv>
        {handle.queue_position !== undefined ? <Kv k={t('plan.queue')}>{handle.queue_position}</Kv> : null}
        {liveNow ? <button type="button" className={css.planBtn} onClick={onCancel}>{t('plan.cancel')}</button> : null}
      </div>
      {handle.execution_note ? <div className={css.planMeta}>{handle.execution_note}</div> : null}
    </div>
  )
}
