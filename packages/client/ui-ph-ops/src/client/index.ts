/**
 * Browser plugin for the operator rail + mission cockpit. Two registrations:
 * the 任务图 mission cockpit as a `conversation.view` tab (the graph-first view
 * of the running mission), and the operator rail as a `sidebar.section` — the
 * persistent "richer sidebar of panels". Both read the harness evidence layer
 * through the board Remote and render only; no service, no business logic, every
 * number comes from board.store (the Python `session_progress` fold + the
 * session chain).
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'conversation.view' SlotMap row owned by the conversation package.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the 'sidebar.section' SlotMap row owned by the sidebar package.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: the generated ctx.remote merge, including the board namespace.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { en, NS, zh } from './locales.ts'
import { CockpitView, type CockpitInjected } from './CockpitView.tsx'
import { OperatorRail, type RailInjected } from './OperatorRail.tsx'

/** Required services: the conversation + sidebar slots, the board Remote, the copy. */
export const inject = ['slots', 'remote', 'remote.board', 'locale']

/**
 * Client plugin body: register the mission cockpit tab and the operator rail.
 * Each registration rides the slot service's effect wrapper, so plugin unload
 * removes it.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-ph-ops: dictionaries')
  const t = ctx.locale.bind(NS)
  const board = ctx.remote.board

  // Mission cockpit: first conversation-view tab (order below 战报's 20).
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'mission',
    order: 19,
    locale: NS,
    label: () => t('view.mission'),
    inject: (_sessionId: SessionId): CockpitInjected => ({
      fetchSessions: () => board.sessions(),
      fetchSession: (name: string) => board.session({ name }),
      fetchSessionProgress: (name: string) => board.sessionProgress({ name }),
    }),
  }, CockpitView))

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
      fetchStores: () => board.stores(),
      fetchRounds: () => board.rounds(),
    }),
  }, OperatorRail))
}
