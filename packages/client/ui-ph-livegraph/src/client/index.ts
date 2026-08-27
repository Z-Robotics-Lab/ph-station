/**
 * Browser 执行图 (live execution graph) plugin: one entry in the conversation
 * view slot that composes the capability routing network (chain rows), the
 * task plan (plan_built), and live node/stage state (runtimeEvents feed) into
 * one animated graph. Renders only — every status comes verbatim from
 * board.store; the feed is operational state, never chain evidence.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'conversation.view' SlotMap row owned by the conversation package.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the generated ctx.remote merge, including the board namespace.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { en, NS, zh } from './locales.ts'
import type { LiveGraphInjected } from './LiveGraphView.tsx'
import { LabView } from './LabView.tsx'
import { LiveGraphTab, TickerTab, ViewportTab } from './tabs.tsx'
import xyflowBase from './xyflow-base.css?inline'

const PLUGIN_ID = '@deepseek-ai/dsh-client-ui-ph-livegraph'

/** Required services: the conversation slot, the board Remote namespace, the copy. */
export const inject = ['slots', 'remote', 'remote.board', 'locale']

/**
 * Client plugin body: mount React Flow's structural stylesheet for the plugin
 * lifetime (the ui-theme `?inline` channel) and register the 执行图 view tab.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = PLUGIN_ID
    tag.textContent = xyflowBase
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'ui-ph-livegraph: xyflow base stylesheet')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-ph-livegraph: dictionaries')
  const t = ctx.locale.bind(NS)
  const board = ctx.remote.board

  const inject = (_sessionId: SessionId): LiveGraphInjected => ({
    fetchSessions: () => board.sessions(),
    fetchSession: (name: string) => board.session({ name }),
    fetchRuntimeEvents: (name: string, afterSeq: number) => board.runtimeEvents({ name, afterSeq }),
    fetchRuntimeFrame: (name: string, afterTs: number, waitMs: number) => board.runtimeFrame({ name, afterTs, waitMs }),
    fetchKeyframes: (name: string) => board.runtimeKeyframes({ name }),
    fetchKeyframe: (name: string, seq: number) => board.runtimeKeyframe({ name, seq }),
  })

  // 图谱·过程流: the same-screen cockpit pane — the execution graph and the 过程流
  // ticker under one RunFeedProvider. Ordered before Chat (0) and Trajectory (10)
  // so the 实验台 dashboard (order -20) docks it as the default cockpit panel.
  // 执行图谱 stays a standalone tab (order 19) for the graph alone.
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'lab',
    order: -10,
    locale: NS,
    label: () => t('view.lab'),
    inject,
  }, LabView))

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'livegraph',
    order: 19,
    locale: NS,
    label: () => t('view.livegraph'),
    inject,
  }, LiveGraphTab))

  // 过程流: the per-experiment process ticker as a standalone panel, so the
  // dashboard can dock it beside the graph. It shares the graph's run selection
  // through the RunFeedProvider context (§3.3), not a second poll.
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'ticker',
    order: 18,
    locale: NS,
    label: () => t('process'),
    inject,
  }, TickerTab))

  // 取景窗: the live sim viewport as its own panel — the fourth cell of the
  // 实验台 2×2 default grid (dockview owns its splitters and persistence).
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'viewport',
    order: 17,
    locale: NS,
    label: () => t('viewport'),
    inject,
  }, ViewportTab))
}
