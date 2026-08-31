/**
 * Browser plugin for the operator rail. One registration: the operator rail as a
 * `sidebar.section` — the persistent "richer sidebar of panels". The graph-first
 * mission view moved to `ui-ph-livegraph` (the merged 执行图谱). Reads the harness
 * evidence layer through the board Remote and renders only; no service, no
 * business logic, every number comes from board.store (the Python
 * `session_progress` fold + the session chain).
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'sidebar.section' SlotMap row owned by the sidebar package.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: the generated ctx.remote merge, including the board namespace.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { en, NS, zh } from './locales.ts'
import { OperatorRail, type RailInjected } from './OperatorRail.tsx'
import { BrainConsole, type BrainInjected } from './BrainConsole.tsx'

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
}
