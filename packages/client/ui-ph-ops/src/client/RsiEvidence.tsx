/** Backend-owned evaluation, diagnosis, and transfer evidence for an RSI round. */
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { CampaignRound, ResourceCost, SeedRow, TransferEvidence } from './types.ts'
import css from './ops.module.css'

type T = PropsLocale<'phops'>['t']

const value = (v: unknown): string => v === null || v === undefined ? '—' : String(v)
const progress = (v: number | null | undefined): string => typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—'

/** Display the backend's transfer measurement without filling missing observations.
 * @param props - Recorded measurement and localized labels.
 * @returns Transfer statistics, including an explicit censored observation.
 */
export function RsiTransfer({ transfer, t }: { transfer: TransferEvidence; t: T }) {
  const cost = transfer.cost
  const costLine = (c: ResourceCost) => t('rsi.transfer.cost.line', {
    episodes: value(c.episode_attempts), calls: value(c.model_calls), bytes: value(c.input_bytes),
    tokens: value(c.llm_tokens), sim: value(c.sim_s), wall: value(c.wall_s),
  })
  return <div className={css.beat} data-testid="rsi-transfer">
    <span className={css.beatLabel}>{t('rsi.transfer')}</span>
    <div>
      <span>{t('rsi.transfer.line', {
        prior: value(transfer.prior_tasks), first: value(transfer.first_accepted_round), trials: value(transfer.total_trials),
      })}{transfer.censored === true ? ` · ${t('rsi.transfer.censored')}` : ''}</span>
      {(transfer.condition != null || transfer.memory_prefix != null) && <div data-testid="rsi-transfer-context">
        {t('rsi.transfer.context', { condition: value(transfer.condition), prefix: value(transfer.memory_prefix) })}
      </div>}
      {transfer.claim != null && <div data-testid="rsi-transfer-claim">{transfer.claim}</div>}
      {(cost != null || transfer.accepted_updates !== undefined) && <div className={css.dim} data-testid="rsi-transfer-cost-scope">
        {t('rsi.transfer.cost.scope', { accepted: value(transfer.accepted_updates) })}
      </div>}
      {cost != null && <>
        <div data-testid="rsi-transfer-cost-total">{t('rsi.transfer.cost.total')}{' · '}{costLine(cost.total)}</div>
        <div data-testid="rsi-transfer-cost-first">{t('rsi.transfer.cost.first')}{' · '}{cost.first_accepted === null ? t('rsi.transfer.cost.notAccepted') : costLine(cost.first_accepted)}</div>
        <details className={css.logBlock} data-testid="rsi-transfer-cost-cycle">
          <summary>{t('rsi.transfer.cost.cycle')}</summary>
          <div>{costLine(cost.since_previous_acceptance)}</div>
        </details>
      </>}
    </div>
  </div>
}

/** Render decisions and evidence supplied by the harness for one selected round.
 * @param props - Full round data and localized labels.
 * @returns Fixed-objective evaluation, separate decisions, and inspectable evidence.
 */
export function RsiEvidence({ round, t }: { round: CampaignRound; t: T }) {
  const e = round.evaluation
  const observed = (rows: SeedRow[] | null | undefined) => (rows ?? [])
    .filter(s => s.evaluation != null || s.verification_observations != null || s.terminal_observation != null)
    .map(({ seed, evaluation, verification_observations, terminal_observation }) => ({
      seed, evaluation, verification_observations, terminal_observation,
    }))
  const observations = { before: observed(round.per_seed), after: observed(round.after_seeds) }
  return <>
    {round.policy != null && <div className={css.beat} data-testid="rsi-policy">
      <span className={css.beatLabel}>{t('rsi.policy')}</span>
      <div className={css.policyVersions}>
        <div>{round.policy.representation === 'program_overlay' ? t('rsi.policy.program') : value(round.policy.representation)}
          {' · '}{t('rsi.policy.updated', { updated: round.policy.updated === true ? t('yes') : round.policy.updated === false ? t('no') : '—' })}</div>
        <details className={css.identityDetails}>
          <summary>{t('rsi.identities')}</summary>
          <div className={css.mono}>{t('rsi.policy.versions', { before: value(round.policy.before_id), candidate: value(round.policy.candidate_id), active: value(round.policy.active_id) })}</div>
          {round.policy.parent_id != null && <div className={css.mono}>{t('rsi.policy.parent', { parent: round.policy.parent_id })}</div>}
        </details>
      </div>
    </div>}
    {e != null && <div data-testid="rsi-evaluation">
      <div className={css.beat}><span className={css.beatLabel}>{t('rsi.evaluation')}</span>
        <details className={css.identityDetails}><summary>{t('rsi.identities')}</summary>
          <span className={css.mono}>{value(e.protocol_id)} · {value(e.objective_id)}</span></details></div>
      <table className={css.table}>
        <thead><tr><th /><th>{t('evolve.before')}</th><th>{t('evolve.after')}{e.after === null ? ` · ${t('rsi.notRetested')}` : ''}</th></tr></thead>
        <tbody>
          <tr><th>{t('rsi.chart.task')}</th>{[e.before, e.after].map((s, i) => <td key={i}>{value(s?.successes)}/{value(s?.episodes)}</td>)}</tr>
          <tr><th>{t('rsi.chart.objective')}</th>{[e.before, e.after].map((s, i) => <td key={i}>{progress(s?.progress)}</td>)}</tr>
          <tr><th>{t('rsi.obligations')}</th>{[e.before, e.after].map((s, i) => <td key={i}>{value(s?.obligations)}</td>)}</tr>
        </tbody>
      </table>
      <div className={css.beat} data-testid="rsi-acceptance"><span className={css.beatLabel}>{t('rsi.acceptance')}</span>
        <span>{e.acceptance?.accepted === true ? t('rsi.accepted') : e.acceptance?.accepted === false ? t('rsi.rejected') : '—'}
          {e.acceptance?.reason ? ` · ${e.acceptance.reason}` : ''}</span></div>
      <div className={css.beat} data-testid="rsi-installation"><span className={css.beatLabel}>{t('rsi.installation')}</span>
        <span>{e.installation?.status === 'not_evaluated' ? t('rsi.notEvaluated') : value(e.installation?.status)}
          {e.installation?.reason ? ` · ${e.installation.reason}` : ''}</span></div>
    </div>}
    {round.tried?.kind === 'plan' && <details className={css.logBlock} data-testid="rsi-plan-evidence">
      <summary>{t('rsi.planEvidence')}</summary>
      <pre className={css.evidenceJson}>{JSON.stringify(round.tried.detail, null, 2)}</pre>
    </details>}
    {round.diagnosis != null && <details className={css.logBlock} data-testid="rsi-diagnosis">
      <summary>{t('rsi.diagnosis')} · {value(round.diagnosis.status)}</summary>
      <pre className={css.evidenceJson}>{JSON.stringify(round.diagnosis, null, 2)}</pre>
    </details>}
    {(observations.before.length > 0 || observations.after.length > 0) && <details className={css.logBlock} data-testid="rsi-observations">
      <summary>{t('rsi.observations')}</summary>
      <pre className={css.evidenceJson}>{JSON.stringify(observations, null, 2)}</pre>
    </details>}
    {round.experience != null && <details className={css.logBlock} data-testid="rsi-experience">
      <summary>{t('rsi.experience')}</summary>
      <pre className={css.evidenceJson}>{JSON.stringify(round.experience, null, 2)}</pre>
    </details>}
    {round.learning != null && <details className={css.logBlock} data-testid="rsi-learning">
      <summary>{t('rsi.learning')}</summary>
      <div className={css.dim}>{t('rsi.learning.scope')}</div>
      <pre className={css.evidenceJson}>{JSON.stringify(round.learning, null, 2)}</pre>
    </details>}
    {round.transfer != null && <RsiTransfer transfer={round.transfer} t={t} />}
  </>
}
