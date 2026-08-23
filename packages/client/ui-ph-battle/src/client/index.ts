/**
 * Browser 战报 (battle-report) plugin: one entry in the conversation view slot
 * that reads the harness evidence layer through the board Remote and renders
 * only. No service, no business logic — every number comes from board.store.
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
import { BattleView, type BattleViewInjected } from './BattleView.tsx'

/** Required services: the conversation slot, the board Remote namespace, and the copy. */
export const inject = ['slots', 'remote', 'remote.board', 'locale']

/**
 * Client plugin body: register the 战报 view tab. The registration rides the
 * slot service's effect wrapper, so plugin unload removes the tab.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-ph-battle: dictionaries')
  const t = ctx.locale.bind(NS)
  const board = ctx.remote.board
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'battle',
    order: 20,
    locale: NS,
    label: () => t('view.battle'),
    inject: (_sessionId: SessionId): BattleViewInjected => ({
      fetchStores: () => board.stores(),
      fetchStore: (name: string) => board.store({ name }),
      fetchHeldout: (name: string) => board.heldout({ name }),
    }),
  }, BattleView))
}
