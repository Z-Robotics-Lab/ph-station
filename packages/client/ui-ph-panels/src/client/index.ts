/**
 * Browser plugin for the 严格评测 / 迭代记录 / 账本 panels and the status bar.
 * Each view is one entry in a slot — three `conversation.view` entries, the
 * status bar in the frame-wide `shell.overlay` — reading the harness evidence layer
 * through the board Remote and rendering only. No service, no business logic:
 * every number comes from board.store / board.cards.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'conversation.view' SlotMap row owned by the conversation package.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the 'shell.overlay' SlotMap row owned by the layout package.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: the generated ctx.remote merge, including the board namespace.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { en, NS, zh } from './locales.ts'
import { RsiRun, type RsiConsoleInjected } from './RsiRun.tsx'
import { EvolutionView, type EvolutionInjected } from './EvolutionView.tsx'
import { LedgerView, type LedgerInjected } from './LedgerView.tsx'
import { StatusBar, type StatusInjected } from './StatusBar.tsx'
import { TaskChips } from './TaskChips.tsx'

/** Required services: the conversation + shell slots, the board Remote, the copy. */
export const inject = ['slots', 'remote', 'remote.board', 'locale']

/**
 * Client plugin body: register the three view entries and the status bar. Each
 * registration rides the slot service's effect wrapper, so plugin unload
 * removes them.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-ph-panels: dictionaries')
  const t = ctx.locale.bind(NS)
  const board = ctx.remote.board

  ctx.slots.inject('conversation.view', () => {
    const disposers = [
      // 严格评测: the legacy heavy-chain launcher + stepper (`{"kind":"rsi"}`),
      // kept out of the tab strip; the unified RSI page (ui-ph-ops, view id
      // 'rsi') embeds it by id through renderView, beside 迭代记录 / 战报 / 账本.
      // Its inject face includes submitBrief, the board Remote's one write.
      ctx.slots.register({
        name: 'conversation.view',
        id: 'rsi-strict',
        order: 20,
        locale: NS,
        label: () => t('view.rsiStrict'),
        inject: (_sessionId: SessionId): RsiConsoleInjected => ({
          fetchCards: () => board.cards(),
          fetchSessions: () => board.sessions(),
          fetchRuntimeStatus: (name: string) => board.runtimeStatus({ name }),
          fetchSession: (name: string) => board.session({ name }),
          fetchCampaignProgress: () => board.campaignProgress(),
          submitBrief: (briefJson: string, session: string) => board.submitBrief(briefJson, session),
        }),
      }, RsiRun),
      ctx.slots.register({
        name: 'conversation.view',
        id: 'evolution',
        order: 21,
        locale: NS,
        label: () => t('view.evolution'),
        inject: (_sessionId: SessionId): EvolutionInjected => ({
          fetchRounds: () => board.rounds(),
          fetchStores: () => board.stores(),
          fetchStore: (name: string) => board.store({ name }),
          fetchCampaignProgress: () => board.campaignProgress(),
        }),
      }, EvolutionView),
      ctx.slots.register({
        name: 'conversation.view',
        id: 'ledger',
        order: 23,
        locale: NS,
        label: () => t('view.ledger'),
        inject: (_sessionId: SessionId): LedgerInjected => ({
          fetchLedger: () => board.ledger(),
        }),
      }, LedgerView),
    ]
    return () => { for (const d of disposers) d() }
  })

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'ph-status',
    order: 10,
    locale: NS,
    inject: (): StatusInjected => ({
      fetchSessions: () => board.sessions(),
      fetchSession: (name: string) => board.session({ name }),
      fetchRuntimeStatus: (name: string) => board.runtimeStatus({ name }),
    }),
  }, StatusBar))

  // 任务台 quick chips above the composer: prefill-only presets (setDraft via
  // the session standard kit, no inject face). Below the plan strip (order 0).
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'ph-task-chips',
    order: 20,
    locale: NS,
  }, TaskChips))
}
