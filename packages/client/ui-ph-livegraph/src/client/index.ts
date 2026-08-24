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
import { LiveGraphView, type LiveGraphInjected } from './LiveGraphView.tsx'
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

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'livegraph',
    order: 19,
    locale: NS,
    label: () => t('view.livegraph'),
    inject: (_sessionId: SessionId): LiveGraphInjected => ({
      fetchSessions: () => board.sessions(),
      fetchSession: (name: string) => board.session({ name }),
      fetchRuntimeEvents: (name: string, afterSeq: number) => board.runtimeEvents({ name, afterSeq }),
    }),
  }, LiveGraphView))
}
