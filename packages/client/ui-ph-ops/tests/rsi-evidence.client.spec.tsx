// @vitest-environment jsdom
/** Acceptance, installation, and fixed-obligation progress retain backend meaning. */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RsiEvidence } from '../src/client/RsiEvidence.tsx'
import { en, zh } from '../src/client/locales.ts'
import type { CampaignRound, ResourceCost } from '../src/client/types.ts'

afterEach(cleanup)

const t = ((key: keyof typeof en, params?: Record<string, unknown>) =>
  en[key].replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k]))) as Parameters<typeof RsiEvidence>[0]['t']

const cost: ResourceCost = { episode_attempts: 7, model_calls: 3, input_bytes: 1800, llm_tokens: 42, sim_s: 12.5, wall_s: 20 }
const unknownCost: ResourceCost = {
  episode_attempts: null, model_calls: null, input_bytes: null, llm_tokens: null, sim_s: null, wall_s: null,
}

const round = {
  round: 3, published: true, tried: { kind: 'plan', detail: { graph: { nodes: [{ id: 'base-adjust', skill: 'installed_navigation' }] } } },
  evaluation: {
    protocol_id: 'fixed-obligations-v1', objective_id: 'task:transfer',
    before: { successes: 0, episodes: 2, progress: 0.25, obligations: 4 },
    after: { successes: 0, episodes: 2, progress: 0.5, obligations: 4 },
    acceptance: { accepted: true, reason: 'progress improved without regression' },
    installation: { status: 'not_evaluated', reason: 'four-stage battery has not run' },
  },
  diagnosis: { status: 'observed', findings: [{ kind: 'inactive_control', channel: 'base', evidence: { active: false, residual: 0.4 } }] },
  experience: { retrieved: [{ id: 'prior-task/2', intervention: 'enable base control' }], recorded: 'this-task/3' },
  transfer: { prior_tasks: 4, first_accepted_round: null, total_trials: 3, censored: true },
} satisfies CampaignRound

describe('RSI evaluation evidence', () => {
  it('shows development acceptance without claiming installation, even with a legacy publication flag', () => {
    render(<RsiEvidence round={round} t={t} />)
    expect(screen.getByTestId('rsi-acceptance').textContent).toBe('Development acceptanceAccepted · progress improved without regression')
    expect(screen.getByTestId('rsi-installation').textContent).toBe('Verified installationInstallation not evaluated · four-stage battery has not run')
    expect(screen.getByTestId('rsi-evaluation').textContent).toMatchInlineSnapshot('"Fixed task evaluationVersion and evidence IDsfixed-obligations-v1 · task:transferbeforeafterWhole-task success0/20/2Fixed task progress25.0%50.0%Fixed obligations44Development acceptanceAccepted · progress improved without regressionVerified installationInstallation not evaluated · four-stage battery has not run"')
    expect(screen.getByTestId('rsi-plan-evidence').textContent).toContain('installed_navigation')
    expect(screen.getByTestId('rsi-diagnosis').textContent).toContain('"active": false')
    expect(screen.getByTestId('rsi-experience').textContent).toContain('prior-task/2')
    expect(screen.getByTestId('rsi-transfer').textContent).toBe('Cross-task transferPrior tasks 4 · first accepted round — · trials 3 · No acceptance observed within this budget')
  })

  it('preserves the backend transfer condition, memory cutoff and limit on scale claims', () => {
    const claim = 'One development task; no paired transfer or scale claim.'
    render(<RsiEvidence round={{ transfer: { condition: 'cold', memory_prefix: 0, claim } }} t={t} />)
    expect(screen.getByTestId('rsi-transfer-context').textContent).toBe('Condition cold · experience cutoff 0')
    expect(screen.getByTestId('rsi-transfer-claim').textContent).toBe(claim)
    expect(screen.getByTestId('rsi-transfer').textContent).toContain('first accepted round —')
    expect(screen.getByTestId('rsi-transfer').textContent).not.toContain('No acceptance observed within this budget')
    expect(screen.queryByTestId('rsi-transfer-cost-total')).toBeNull()
  })

  it('keeps recorded total, first-acceptance and preceding-acceptance costs distinct within one epoch', () => {
    render(<RsiEvidence round={{ transfer: { accepted_updates: 2, first_accepted_round: 3,
      cost: { total: cost, first_accepted: { ...cost, episode_attempts: 4, llm_tokens: 30 },
        since_previous_acceptance: { ...cost, episode_attempts: 2, llm_tokens: 8 } },
    } }} t={t} />)
    expect(screen.getByTestId('rsi-transfer-cost-scope').textContent).toBe('Current development epoch · accepted updates 2')
    expect(screen.getByTestId('rsi-transfer-cost-total').textContent).toBe('Total resources · Episode attempts 7 · model calls 3 · input 1800 B · LLM 42 tokens · simulation 12.5 s · elapsed 20 s')
    expect(screen.getByTestId('rsi-transfer-cost-first').textContent).toContain('First accepted update cost · Episode attempts 4')
    expect(screen.getByTestId('rsi-transfer-cost-first').textContent).toContain('LLM 30 tokens')
    const cycle = screen.getByTestId('rsi-transfer-cost-cycle') as HTMLDetailsElement
    expect(cycle.open).toBe(false)
    expect(cycle.querySelector('summary')?.textContent).toBe('Resources since the preceding acceptance (including this round)')
    expect(cycle.textContent).toContain('Episode attempts 2')
    expect(cycle.textContent).toContain('LLM 8 tokens')
    expect(screen.queryByTestId('rsi-acceptance')).toBeNull()
    expect(screen.queryByTestId('rsi-installation')).toBeNull()
  })

  it('shows no first acceptance without replacing its cost with zero or cumulative consumption', () => {
    render(<RsiEvidence round={{ transfer: { accepted_updates: 0, first_accepted_round: null,
      cost: { total: cost, first_accepted: null, since_previous_acceptance: cost },
    } }} t={t} />)
    expect(screen.getByTestId('rsi-transfer-cost-scope').textContent).toContain('accepted updates 0')
    expect(screen.getByTestId('rsi-transfer-cost-first').textContent).toBe('First accepted update cost · Not yet accepted')
    expect(screen.getByTestId('rsi-transfer-cost-total').textContent).toContain('LLM 42 tokens')
  })

  it('distinguishes accepted but unmeasured costs from no acceptance and preserves measured zero', () => {
    render(<RsiEvidence round={{ transfer: { first_accepted_round: 3,
      cost: {
        total: { ...unknownCost, model_calls: 0, llm_tokens: 0 },
        first_accepted: unknownCost, since_previous_acceptance: unknownCost,
      },
    } }} t={t} />)
    expect(screen.getByTestId('rsi-transfer-cost-scope').textContent).toContain('accepted updates —')
    expect(screen.getByTestId('rsi-transfer-cost-total').textContent).toContain('model calls 0')
    expect(screen.getByTestId('rsi-transfer-cost-total').textContent).toContain('LLM 0 tokens')
    expect(screen.getByTestId('rsi-transfer-cost-first').textContent).toBe('First accepted update cost · Episode attempts — · model calls — · input — B · LLM — tokens · simulation — s · elapsed — s')
    expect(screen.getByTestId('rsi-transfer-cost-first').textContent).not.toContain('Not yet accepted')
  })

  it('labels resource units and no first acceptance in Chinese without a monetary estimate', () => {
    const tZh = ((key: keyof typeof zh, params?: Record<string, unknown>) =>
      zh[key].replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k]))) as typeof t
    render(<RsiEvidence round={{ transfer: { accepted_updates: 0,
      cost: { total: cost, first_accepted: null, since_previous_acceptance: cost },
    } }} t={tZh} />)
    expect(screen.getByTestId('rsi-transfer-cost-scope').textContent).toBe('当前开发周期 · 已接受改进 0 次')
    expect(screen.getByTestId('rsi-transfer-cost-total').textContent).toBe('累计投入 · episode 尝试 7 · 模型调用 3 · 输入 1800 B · LLM 42 tokens · 仿真 12.5 s · 经过时间 20 s')
    expect(screen.getByTestId('rsi-transfer-cost-first').textContent).toBe('首次接受改进投入 · 尚未接受')
    expect(screen.getByTestId('rsi-transfer-cost-cycle').querySelector('summary')?.textContent).toBe('最近接受之后的投入（包含本轮）')
  })

  it('keeps successful exploration separate from paired acceptance and the active program policy', () => {
    const learning = { method: 'online_program_policy_v1', selected_policy_id: 'candidate-2',
      probes: [{ policy_id: 'candidate-2', parent_id: 'baseline-1', scope: 'probe', seeds: [1], evaluation: { successes: 1, episodes: 1, progress: 1 }, feedback: { reward: 1 } }] }
    render(<RsiEvidence round={{ ...round,
      policy: { before_id: 'baseline-1', candidate_id: 'candidate-2', active_id: 'baseline-1', parent_id: 'ancestor-0', updated: false, representation: 'program_overlay' },
      evaluation: { ...round.evaluation, acceptance: { accepted: false, reason: 'paired trial did not improve' } }, learning,
    }} t={t} />)
    const policy = screen.getByTestId('rsi-policy').textContent
    expect(policy).toContain('Online program-policy improvement (no weight training)')
    expect(policy).toContain('Policy updated: no')
    expect(policy).toContain('Baseline baseline-1 → candidate candidate-2 · active baseline-1')
    expect(policy).toContain('Parent version ancestor-0')
    expect(screen.getByTestId('rsi-acceptance').textContent).toContain('Not accepted')
    expect(screen.getByTestId('rsi-installation').textContent).toContain('Installation not evaluated')
    expect(screen.getByTestId('rsi-learning').textContent).toContain('Probes provide exploration feedback')
    expect(JSON.parse(screen.getByTestId('rsi-learning').querySelector('pre')?.textContent ?? '{}')).toEqual(learning)
  })

  it('does not infer policy activation from missing version IDs or an absent update decision', () => {
    render(<RsiEvidence round={{ policy: { representation: 'program_overlay', candidate_id: 'candidate-2' } }} t={t} />)
    expect(screen.getByTestId('rsi-policy').textContent).toContain('Policy updated: —')
    expect(screen.getByTestId('rsi-policy').textContent).toContain('Baseline — → candidate candidate-2 · active —')
    expect(screen.queryByTestId('rsi-learning')).toBeNull()
  })

  it('preserves unknown decisions and missing measurements instead of rendering zeros or failure', () => {
    render(<RsiEvidence round={{ evaluation: { before: null, after: {}, acceptance: {}, installation: {} } }} t={t} />)
    expect(screen.getByTestId('rsi-acceptance').textContent).toBe('Development acceptance—')
    expect(screen.getByTestId('rsi-installation').textContent).toBe('Verified installation—')
    expect(screen.getByTestId('rsi-evaluation').textContent).not.toContain('0%')
    expect(screen.queryByTestId('rsi-diagnosis')).toBeNull()
    expect(screen.queryByTestId('rsi-observations')).toBeNull()
  })

  it('shows an unrun retest without copying baseline measurements into the after column or chart', () => {
    const evaluation = { ...round.evaluation, after: null, acceptance: { accepted: false, reason: 'no candidate' } }
    render(<RsiEvidence round={{ ...round, evaluation, after: null, after_seeds: [] }} t={t} />)
    expect(screen.getByRole('columnheader', { name: 'after · Not retested' })).toBeTruthy()
    expect(screen.getByTestId('rsi-evaluation').querySelectorAll('tbody tr')[1]?.textContent).toBe('Fixed task progress25.0%—')
  })

  it('keeps blocked verifier reads and unknown raw observations inspectable per seed and phase', () => {
    const observation = { node: { id: 'grasped-can1' }, value: null, blocked_reads: ['actor.success'], source: 'world-dependencies-v1' }
    render(<RsiEvidence round={{
      per_seed: [{
        seed: 4243, evaluation: { complete: false, observed: 0 },
        verification_observations: [observation], terminal_observation: { value: false },
      }],
      after_seeds: [{ seed: 4243, verification_observations: [{ ...observation, value: false, blocked_reads: [] }] }],
    }} t={t} />)
    const evidence = screen.getByTestId('rsi-observations').querySelector('pre')?.textContent
    const raw = JSON.parse(evidence ?? '{}')
    expect(raw.before[0].verification_observations[0]).toEqual(observation)
    expect(raw.before[0].evaluation.observed).toBe(0)
    expect(raw.before[0].terminal_observation.value).toBe(false)
    expect(raw.after[0].verification_observations[0].value).toBe(false)
  })

})
