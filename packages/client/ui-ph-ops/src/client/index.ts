/**
 * Browser plugin for the operator rail. One registration: the operator rail as a
 * `sidebar.section` — the persistent "richer sidebar of panels". The graph-first
 * mission view moved to `ui-ph-livegraph` (the merged 执行图谱). Reads the harness
 * evidence layer through the board Remote and renders only; no service, no
 * business logic, every number comes from board.store (the Python
 * `session_progress` fold + the session chain).
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'sidebar.section' SlotMap row owned by the sidebar package.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: the generated ctx.remote merge, including the board namespace.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { en, NS, zh } from './locales.ts'
import { OperatorRail, type RailInjected } from './OperatorRail.tsx'
import { BrainConsole, type BrainInjected } from './BrainConsole.tsx'
import { SkillsView, type SkillsInjected } from './SkillsView.tsx'
import { EvolveView, type EvolveInjected } from './EvolveView.tsx'

/** Required services: the sidebar slot, the board + brain Remotes, the copy. */
export const inject = ['slots', 'remote', 'remote.board', 'remote.brain', 'locale']

/**
 * Client plugin body: register the operator rail. The registration rides the
 * slot service's effect wrapper, so plugin unload removes it.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-ph-ops: dictionaries')
  const board = ctx.remote.board
  const brain = ctx.remote.brain
  const t = ctx.locale.bind(NS)

  // Operator rail: the persistent sidebar section of at-a-glance panels.
  ctx.slots.inject('sidebar.section', () => ctx.slots.register({
    name: 'sidebar.section',
    id: 'ops-rail',
    order: 10,
    locale: NS,
    inject: (): RailInjected => ({
      fetchSessions: () => board.sessions(),
      fetchSession: (name: string) => board.session({ name }),
      fetchSessionProgress: (name: string) => board.sessionProgress({ name }),
      fetchRuntimeStatus: (name: string) => board.runtimeStatus({ name }),
      fetchRuntimeEvents: (name: string) => board.runtimeEvents({ name }),
      fetchStores: () => board.stores(),
      fetchRounds: () => board.rounds(),
      fetchHostVitals: () => board.hostVitals(),
      modelServer: (action: string) => board.modelServer(action),
      policyServer: (action: string) => board.policyServer(action),
      restartServices: (build: boolean) => board.restartServices(build),
      fetchHealth: () => board.health(),
    }),
  }, OperatorRail))

  // Brain console: the mission planner that dispatches the plan through the
  // board (submit_brief → brief_status) with bounded replan-on-failure.
  ctx.slots.inject('sidebar.section', () => ctx.slots.register({
    name: 'sidebar.section',
    id: 'brain-console',
    order: 15,
    locale: NS,
    inject: (): BrainInjected => ({
      plan: (mission, session, priorFailuresJson) => brain.plan(mission, session, priorFailuresJson),
      submitBrief: (briefJson, session) => board.submitBrief(briefJson, session),
      briefStatus: (briefId, session, waitMs) => board.briefStatus({ briefId, session, waitMs }),
    }),
  }, BrainConsole))

  // 技能 page: the records overview table with per-executor evidence.
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'skills',
    order: 24,
    locale: NS,
    label: () => t('view.skills'),
    inject: (_sessionId: SessionId): SkillsInjected => ({
      fetchSessions: () => board.sessions(),
      fetchSkills: (name: string) => board.skills({ name }),
    }),
  }, SkillsView))

  // 演化 page: the lightweight evolve loop — list, start, watch, stop, resume.
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'evolve',
    order: 25,
    locale: NS,
    label: () => t('view.evolve'),
    inject: (_sessionId: SessionId): EvolveInjected => ({
      fetchSessions: () => board.sessions(),
      fetchRuntimeEvents: (name: string) => board.runtimeEvents({ name }),
      fetchRsiRun: (name: string, task: string) => board.rsiRun({ session: name, task }),
      fetchRsiSeries: (name: string, task: string) => board.rsiSeries({ session: name, task }),
      fetchRsiFrames: (name: string, task: string, round: number) => board.rsiFrames({ session: name, task, round }),
      submitBrief: (briefJson: string, session: string) => board.submitBrief(briefJson, session),
      cancelBrief: (briefId: string, session: string) => board.cancelBrief(briefId, session),
    }),
  }, EvolveView))
}
