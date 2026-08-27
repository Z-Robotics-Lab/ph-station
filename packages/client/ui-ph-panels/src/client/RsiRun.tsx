/** Run-RSI launcher + chain stepper for the 演化台 head. One button replaces the
 * hand-written `{"kind":"rsi","task":...}` brief: pick a task (from the 机箱
 * cards' task_bindings), pick an evolution-mode session (from sessions +
 * runtimeStatus), submit through the board Remote's one write. Renders only —
 * the task list, the mode filter, the heartbeat age, the chain stage, and the
 * gate verdict are all board facts shown verbatim; the stale badge displays an
 * age, never blocks a submit, and the brief is never validated client-side
 * (the resident runtime is the sole authority). */

import { useCallback, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { agoSeconds, finite, formatAgo } from './format.ts'
import { Term } from './chrome.tsx'
import { usePolledLoad } from './poll.ts'
import css from './panels.module.css'

/** The board reads + the one write the 演化台 head drives, injected by the slot
 * registration (the sub-panels it aggregates keep their own inject faces). */
export interface RsiConsoleInjected {
  fetchCards: () => Promise<RemoteResult<unknown>>
  fetchSessions: () => Promise<RemoteResult<unknown>>
  fetchRuntimeStatus: (name: string) => Promise<RemoteResult<unknown>>
  fetchSession: (name: string) => Promise<RemoteResult<unknown>>
  fetchCampaignProgress: () => Promise<RemoteResult<unknown>>
  submitBrief: (briefJson: string, session: string) => Promise<RemoteResult<unknown>>
}

// Presentation shapes over board JSON (subset of the fields rendered).
interface Card { contributes?: { task_bindings?: string[] } }
interface SessionSummary { name?: string; mtime?: number | null; kinds?: Record<string, number> }
/** One evolution-mode session for the dropdown: name + heartbeat mtime (the
 * session-log mtime the status bar also shows) — age is displayed, not judged. */
interface EvoSession { name: string; mtime: number | null }
/** An rsi chain's campaign_progress heartbeat (the row with a `stage`): the
 * chain position plus everything the stepper card shows, all folded python-side. */
interface ChainRow {
  name?: string
  label?: string | null
  done?: number
  total?: number
  running?: boolean
  stage?: string | null
  verdict?: string | null
  target_node?: string | null
  failed?: string[]
  first_death?: Record<string, number>
  succeeded?: number
  blocks?: Record<string, number[]>
  promoted?: boolean | null
  prereg_sha?: string | null
}
/** The sealed runtime.rsi_scheduled chain row's gate payload (written once the
 * chain subprocess finishes; the live heartbeat carries the same verdict). */
interface GatePayload { proceed?: boolean; failed?: string[]; target_node?: string | null }
interface RsiScheduled { brief?: string; gate?: GatePayload }
interface SessionDetail { rows?: Record<string, unknown[]> }

/** The discipline chain's seven links, in order (locale keys `rsi.step.<id>`). */
const STEPS = ['allocate', 'calibrate', 'gate', 'prereg', 'dev', 'heldout', 'install'] as const

/** Where each heartbeat `stage` name sits on the seven-step chain — a display
 * mapping of python's stage vocabulary (like EvolutionView's STAGE_KEYS), not a
 * judgement: a heartbeat exists only after allocate; the dev beat carries the
 * sealed prereg_sha, so `dev` sits past prereg; `done` closes the whole chain
 * (held-out runs inside it); `stopped` is the honest stop AT the gate. An
 * unknown stage maps to 0 so a new python link renders as position rather than
 * crashing the strip. */
const STAGE_POS: Record<string, number> = { calibrate: 1, gate: 2, dev: 4, done: 7, stopped: 2 }

/** The gate's six preregistered criteria ids, chip order. A failed id outside
 * this set still renders (red) so a new python criterion never vanishes. */
const GATE_CRITERIA = [
  'c1_base_degenerate', 'c2_base_ceiling', 'c3_budget_exhaust_dominant',
  'c4_attribution', 'c5_recovery_primitive', 'c6_wall_clock',
]

/** Heartbeat age (~10 min) past which the gray stale badge shows. A displayed
 * fact only — the submit button never gates on it (a stale-looking runtime may
 * be alive; the runtime itself is the only authority). */
const STALE_S = 600

/** Everything with a task binding, flattened across the 机箱 cards. */
function flattenTasks(cards: Card[]): string[] {
  const all = new Set<string>()
  for (const c of cards) for (const task of c.contributes?.task_bindings ?? []) all.add(task)
  return [...all].sort()
}

export function RsiRun({
  fetchCards, fetchSessions, fetchRuntimeStatus, fetchSession, fetchCampaignProgress, submitBrief, t,
}: InjectFace<RsiConsoleInjected> & PropsLocale<'phpanels'>) {
  const [tasks, setTasks] = useState<string[]>([])
  const [sessions, setSessions] = useState<EvoSession[]>([])
  const [chain, setChain] = useState<ChainRow | null>(null)
  const [sealedGate, setSealedGate] = useState<GatePayload | null>(null)
  const [task, setTask] = useState('')
  const [session, setSession] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const [c, s, p] = await Promise.all([fetchCards(), fetchSessions(), fetchCampaignProgress()])
      setNow(Date.now())
      if (c.ok) setTasks(flattenTasks(c.value as Card[]))
      if (s.ok) {
        // Sessions with a runtime.boot row, each asked for its LIVE mode; only
        // evolution-mode sessions can claim an rsi brief, so only those list.
        const booted = (s.value as SessionSummary[]).filter(
          row => row.name !== undefined && row.kinds?.['runtime.boot'] !== undefined)
        const modes = await Promise.all(booted.map(async (row) => {
          const r = await fetchRuntimeStatus(row.name as string)
          const mode = r.ok ? (r.value as { mode?: string } | null)?.mode : undefined
          return { name: row.name as string, mtime: row.mtime ?? null, mode }
        }))
        setSessions(modes.filter(m => m.mode === 'evolution')
          .map(({ name, mtime }) => ({ name, mtime })))
      }
      if (p.ok) {
        // The newest rsi-chain heartbeat (the campaign_progress row carrying a
        // `stage`); the list arrives newest-first from python.
        const rows = (p.value as ChainRow[]).filter(r => r.stage !== null && r.stage !== undefined)
        const top = rows[0] ?? null
        setChain(top)
        // A chain fired through the runtime heartbeats at <session>/<brief>;
        // its sealed gate payload is the session chain's runtime.rsi_scheduled
        // row whose brief matches. Absent (still running / hand-run store) the
        // stepper falls back to the live heartbeat's own verdict fields.
        const slash = top?.name?.indexOf('/') ?? -1
        if (top?.name !== undefined && slash > 0) {
          const stem = top.name.slice(slash + 1)
          const d = await fetchSession(top.name.slice(0, slash))
          const rsiRows = d.ok
            ? ((d.value as SessionDetail).rows?.['runtime.rsi_scheduled'] ?? []) as RsiScheduled[]
            : []
          const match = [...rsiRows].reverse().find(
            r => typeof r.brief === 'string' && r.brief.replace(/\.[^.]*$/, '') === stem)
          setSealedGate(match?.gate ?? null)
        } else {
          setSealedGate(null)
        }
      }
    } catch {
      // keep the last-good lists; the sub-panels report board-offline themselves
    }
  }, [fetchCards, fetchSessions, fetchRuntimeStatus, fetchSession, fetchCampaignProgress])

  usePolledLoad(load)

  const submit = async () => {
    setBusy(true)
    setSubmitted(null)
    setSubmitError(null)
    try {
      const r = await submitBrief(JSON.stringify({ kind: 'rsi', task }), session)
      if (r.ok) {
        const v = r.value as { submitted?: string } | null
        setSubmitted(v?.submitted ?? '—')
      } else {
        setSubmitError(r.error.message)
      }
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const selectedAge = agoSeconds(sessions.find(s => s.name === session)?.mtime, now)

  return (
    <div className={css.rsiBox}>
      <div className={css.rsiRow}>
        <span className={css.rsiTitle}>{t('rsi.run')}</span>
        <select className={css.rsiSelect} value={task} onChange={(e) => { setTask(e.target.value) }}>
          <option value="">{t('rsi.taskPick')}</option>
          {tasks.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className={css.rsiSelect} value={session} onChange={(e) => { setSession(e.target.value) }}>
          <option value="">{t('rsi.sessionPick')}</option>
          {sessions.map((s) => {
            const age = agoSeconds(s.mtime, now)
            return (
              <option key={s.name} value={s.name}>
                {s.name}{age === null ? '' : ` · ${formatAgo(age)}`}
              </option>
            )
          })}
        </select>
        {selectedAge !== null && selectedAge > STALE_S
          ? <span className={`${css.badge} ${css.badgeMuted}`}>{t('rsi.stale')}</span>
          : null}
        <button
          type="button"
          className={css.rsiButton}
          disabled={busy || task === '' || session === ''}
          onClick={() => { void submit() }}
        >
          {busy ? t('rsi.submitting') : t('rsi.submit')}
        </button>
      </div>
      {tasks.length === 0 ? <div className={css.rsiNote}>{t('rsi.noTasks')}</div> : null}
      {sessions.length === 0 ? <div className={css.rsiNote}>{t('rsi.noSessions')}</div> : null}
      {submitted !== null ? (
        <div className={css.rsiNote}>
          {t('rsi.submitted')} <span className={css.statusMono}>{submitted}</span> — {t('rsi.followBelow')}
        </div>
      ) : null}
      {submitError !== null ? (
        <div className={`${css.rsiNote} ${css.fail}`}>{t('rsi.submitFailed')}: {submitError}</div>
      ) : null}
      <RsiStepper chain={chain} sealedGate={sealedGate} t={t} />
    </div>
  )
}

/** The chain stepper card: allocate → … → install with the heartbeat's stage as
 * the live position, plus done/total, the three seed blocks, the first-death
 * distribution, and the gate's criteria verdict — every value board-folded. */
function RsiStepper({ chain, sealedGate, t }: {
  chain: ChainRow | null
  sealedGate: GatePayload | null
} & PropsLocale<'phpanels'>) {
  if (chain === null) return <div className={css.rsiNote}>{t('rsi.noChain')}</div>

  const stage = chain.stage ?? ''
  const pos = STAGE_POS[stage] ?? 0
  const stopped = stage === 'stopped'
  // The sealed chain row wins when present (the finished chain's one authored
  // record); until it lands, the live heartbeat's own verdict fields show.
  const failed = sealedGate?.failed ?? chain.failed
  const verdict = sealedGate !== null
    ? (sealedGate.proceed === true ? 'GO' : 'NO-GO')
    : chain.verdict
  const targetNode = sealedGate?.target_node ?? chain.target_node
  const done = finite(chain.done) ?? 0
  const total = finite(chain.total) ?? 0
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0
  const deaths = Object.entries(chain.first_death ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxDeath = deaths[0]?.[1] ?? 0
  const criteria = Array.isArray(failed)
    ? [...GATE_CRITERIA, ...failed.filter(f => !GATE_CRITERIA.includes(f))]
    : null

  return (
    <div className={css.rsiChain}>
      <div className={css.rsiRow}>
        <span className={css.rsiChainName}>{chain.name ?? '—'}</span>
        {chain.label ? <span className={css.progressLabel}>{chain.label}</span> : null}
        <span className={css.progressCount}>{done}/{total}</span>
      </div>
      <div className={css.stepper}>
        {STEPS.map((step, i) => {
          const state = stopped && i > pos
            ? css.stepSkipped
            : i < pos || stage === 'done'
              ? css.stepDone
              : i === pos
                ? (stopped ? css.stepStopped : css.stepActive)
                : css.stepPending
          return (
            <span key={step} className={css.stepSeat}>
              {i === 0 ? null : <span className={css.stepArrow}>→</span>}
              <span className={`${css.step} ${state}`}>
                {t(`rsi.step.${step}`)}
              </span>
            </span>
          )
        })}
      </div>
      <div className={css.progressTrack}>
        <div className={css.progressFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={css.rsiRow}>
        {['cal', 'dev', 'heldout'].map((k) => {
          const b = chain.blocks?.[k]
          return Array.isArray(b) && b.length === 2
            ? <span key={k} className={css.badge}>{k} {b[0]}–{b[1]}</span>
            : null
        })}
        {targetNode !== null && targetNode !== undefined
          ? <span className={css.badge}>{t('progressTargetNode')} {targetNode}</span>
          : null}
        {chain.promoted === true ? <span className={`${css.badge} ${css.pass}`}>{t('promoted')}</span> : null}
        {chain.promoted === false ? <span className={`${css.badge} ${css.badgeMuted}`}>{t('rejected')}</span> : null}
      </div>
      {criteria === null ? null : (
        <div className={css.rsiRow}>
          <Term label={t('rsi.criteria')} tip={t('rsi.criteria.tip')} />
          {criteria.map(id => (
            <span
              key={id}
              className={failed !== undefined && failed.includes(id)
                ? `${css.gateChip} ${css.gateChipFail}`
                : `${css.gateChip} ${css.gateChipOk}`}
            >
              {id}
            </span>
          ))}
        </div>
      )}
      {verdict === 'NO-GO' && Array.isArray(failed) ? (
        <div className={css.noGo}>{t('rsi.honestNoGo')}: {failed.join(', ')}</div>
      ) : null}
      {deaths.length > 0 ? (
        <div className={css.deathList}>
          <Term label={t('rsi.firstDeath')} tip={t('firstDeath.tip')} />
          {deaths.map(([node, n]) => (
            <div key={node} className={css.deathRow}>
              <span className={css.deathName}>{node}</span>
              <span className={css.barTrack}>
                <span
                  className={`${css.barFill} ${css.barNeg}`}
                  style={{ width: `${maxDeath > 0 ? (n / maxDeath) * 100 : 0}%` }}
                />
              </span>
              <span className={css.barValue}>×{n}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
