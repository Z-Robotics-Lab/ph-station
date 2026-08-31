/** The 大脑 (brain) console: a sidebar section where the operator types a
 * mission, the brain plans it against the session's skill index (POST
 * /api/brain/plan), and one click dispatches the plan through the board
 * (submit_brief → brief_status) with bounded replan-on-failure. Renders the
 * plan, its operator flags, and each step's live state; every number and state
 * comes from the board or the brain, never fabricated here. */

import { useCallback, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarSectionProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { IconTarget } from '@deepseek-ai/dsh-client-ui-ph-icons'
import {
  isTerminal, MAX_REPLANS, runPlan, type BriefStatus, type LoopStep, type StepReport,
} from './planner-loop.ts'
import css from './ops.module.css'

/** The brain/board Remotes the console drives, injected by the registration. */
export interface BrainInjected {
  /** POST /api/brain/plan: decompose a mission against the session skill index. */
  plan: (mission: string, session: string, priorFailuresJson: string) => Promise<RemoteResult<unknown>>
  /** POST /api/board/submitBrief: drop one task brief into the session inbox. */
  submitBrief: (briefJson: string, session: string) => Promise<RemoteResult<unknown>>
  /** POST /api/board/briefStatus: where one brief is and what it did. */
  briefStatus: (briefId: string, session: string, waitMs: number) => Promise<RemoteResult<unknown>>
}

/** The brain's plan reply (mirrors dsh-ph-brain's BrainPlan; kept local so this
 * client package names no host package). */
interface BrainPlan {
  steps: Array<LoopStep & { rationale?: string }>
  flags: string[]
  note: string
  error?: string
}

const DEFAULT_SESSION = 'session-main'
/** One board long-poll budget per brief_status call, in ms; the loop re-issues
 * until the state is terminal. */
const POLL_WAIT_MS = 8000
/** Safety cap on poll re-issues per brief so a wedged runtime cannot spin the
 * browser forever (≈ 20 min at POLL_WAIT_MS). */
const MAX_POLLS = 150

/** Unwrap a Remote reply to its value, or undefined when the call failed. */
function val<X = unknown>(r: RemoteResult<unknown>): X | undefined {
  return r.ok ? (r.value as X) : undefined
}

/**
 * The brain console section.
 * @param props - injected Remotes, the locale `t`, and the rail width flag.
 * @returns the mission input, plan view, and live dispatch progress.
 */
export function BrainConsole({
  plan, submitBrief, briefStatus, t,
}: SidebarSectionProps & InjectFace<BrainInjected> & PropsLocale<'phops'>) {
  const [session, setSession] = useState(DEFAULT_SESSION)
  const [mission, setMission] = useState('')
  const [current, setCurrent] = useState<BrainPlan | null>(null)
  const [busy, setBusy] = useState<'idle' | 'planning' | 'dispatching'>('idle')
  const [reports, setReports] = useState<StepReport[]>([])
  const [outcome, setOutcome] = useState<string | null>(null)

  const doPlan = useCallback(async () => {
    if (mission.trim().length === 0) return
    setBusy('planning'); setReports([]); setOutcome(null)
    const res = await plan(mission, session, '[]')
    const p = val<BrainPlan>(res)
    setCurrent(p ?? { steps: [], flags: [t('brain.transportFail')], note: '', error: 'transport' })
    setBusy('idle')
  }, [plan, mission, session, t])

  const dispatch = useCallback(async () => {
    if (current === null || current.steps.length === 0) return
    setBusy('dispatching'); setReports([]); setOutcome(null)
    const push = (r: StepReport) => setReports(prev => [...prev.filter(x => x.index !== r.index), r])

    const result = await runPlan(current.steps, {
      submit: async (step: LoopStep) => {
        const brief = JSON.stringify({
          kind: 'task', task: step.task, seed: step.seed,
          max_replans: step.max_replans, max_actuations: step.max_actuations,
        })
        const r = val<{ submitted?: string; error?: string }>(await submitBrief(brief, session))
        if (r?.submitted === undefined) return { error: r?.error ?? t('brain.transportFail') }
        return { briefId: r.submitted }
      },
      poll: async (briefId: string) => {
        let last: BriefStatus = { state: 'queued' }
        for (let i = 0; i < MAX_POLLS; i++) {
          const s = val<BriefStatus>(await briefStatus(briefId, session, POLL_WAIT_MS))
          if (s === undefined) return { state: 'failed', error: t('brain.transportFail') }
          last = s
          if (isTerminal(s.state)) return s
        }
        return last
      },
      replan: async (failures) => {
        const r = val<BrainPlan>(await plan(mission, session, JSON.stringify(failures)))
        return r?.steps ?? []
      },
      onStep: push,
    })

    setOutcome(result.completed
      ? t('brain.completed')
      : (result.flag ?? t('brain.stopped')))
    setBusy('idle')
  }, [current, submitBrief, briefStatus, plan, mission, session, t])

  return (
    <div className={css.brain}>
      <div className={css.brainHead}><IconTarget /> <span>{t('brain.title')}</span></div>

      <label className={css.brainField}>
        <span>{t('brain.session')}</span>
        <input value={session} onChange={e => setSession(e.target.value)} spellCheck={false} />
      </label>
      <label className={css.brainField}>
        <span>{t('brain.mission')}</span>
        <textarea value={mission} rows={3} placeholder={t('brain.missionHint')}
          onChange={e => setMission(e.target.value)} />
      </label>

      <div className={css.brainActions}>
        <button disabled={busy !== 'idle' || mission.trim().length === 0} onClick={() => void doPlan()}>
          {busy === 'planning' ? t('brain.planning') : t('brain.plan')}
        </button>
        <button disabled={busy !== 'idle' || current === null || current.steps.length === 0}
          onClick={() => void dispatch()}>
          {busy === 'dispatching' ? t('brain.dispatching') : t('brain.dispatch')}
        </button>
      </div>

      {current?.error !== undefined && <div className={css.brainError}>{current.note || current.error}</div>}
      {current !== null && current.note.length > 0 && current.error === undefined &&
        <div className={css.brainNote}>{current.note}</div>}

      {current !== null && current.steps.length > 0 && (
        <ol className={css.brainSteps}>
          {current.steps.map((step, i) => {
            const rep = reports.find(r => r.index === i)
            return (
              <li key={`${step.task}-${i}`} className={css.brainStep} data-phase={rep?.phase ?? 'idle'}>
                <span className={css.brainTask}>{step.task}</span>
                <span className={css.brainExec}>
                  {step.executor === null ? t('brain.noExecutor') : `${step.executor.slice(0, 10)}…`}
                </span>
                {rep !== undefined && <span className={css.brainPhase}>{t(`brain.phase.${rep.phase}` as const)}</span>}
                {step.rationale !== undefined && step.rationale.length > 0 &&
                  <span className={css.brainWhy}>{step.rationale}</span>}
              </li>
            )
          })}
        </ol>
      )}

      {current !== null && current.flags.length > 0 && (
        <ul className={css.brainFlags}>
          {current.flags.map((f, i) => <li key={i}>⚑ {f}</li>)}
        </ul>
      )}

      {outcome !== null && <div className={css.brainOutcome}>{outcome}</div>}
      <div className={css.brainBound}>{t('brain.bound', { n: MAX_REPLANS })}</div>
    </div>
  )
}
