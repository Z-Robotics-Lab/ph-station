/**
 * Browser plugin for the 规划 / 技能库 / 演进 / 机箱 / 账本 panels and status bar.
 * Each view is one entry in a slot — five tabs in `conversation.view`, the
 * status bar in the frame-wide `shell.overlay` — reading the harness evidence
 * and planning layers through the board Remote and rendering only. No service,
 * no business logic: every number and every verdict comes from board.store /
 * board.cards / board.planning; the 规划 tab's Execute is the board's own brief
 * lifecycle, enabled only when the harness marked the plan executable.
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
import { EvolutionConsole } from './EvolutionConsole.tsx'
import type { RsiConsoleInjected } from './RsiRun.tsx'
import { EvolutionView, type EvolutionInjected } from './EvolutionView.tsx'
import { CardsView, type CardsInjected } from './CardsView.tsx'
import { LedgerView, type LedgerInjected } from './LedgerView.tsx'
import { StatusBar, type StatusInjected } from './StatusBar.tsx'
import { TaskChips } from './TaskChips.tsx'
import { PlanView, type PlanInjected } from './PlanView.tsx'
import { SkillLibraryView, type SkillLibraryInjected } from './SkillLibraryView.tsx'

/** Required services: the conversation + shell slots, the board Remote, the copy. */
export const inject = ['slots', 'remote', 'remote.board', 'locale']

/**
 * Client plugin body: register the five view tabs and the status bar. Each
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
      // 规划: natural language -> skill chain. Plan is a read (board.planning);
      // Execute is the board's own brief lifecycle, enabled only when the
      // harness said executable.
      ctx.slots.register({
        name: 'conversation.view',
        id: 'plan',
        order: 20,
        locale: NS,
        label: () => t('view.plan'),
        inject: (_sessionId: SessionId): PlanInjected => ({
          planSkillTask: (instruction: string, session: string, seed: number) =>
            board.planSkillTask({ instruction, session, seed }),
          submitSkillPlan: (plan: string, session: string, seed: number) =>
            board.submitSkillPlan({ plan, session, seed }),
          briefStatus: (briefId: string, session: string) => board.briefStatus({ briefId, session }),
          cancelBrief: (briefId: string, session: string) => board.cancelBrief({ briefId, session }),
        }),
      }, PlanView),
      ctx.slots.register({
        name: 'conversation.view',
        id: 'skill-library',
        order: 21,
        locale: NS,
        label: () => t('view.library'),
        inject: (_sessionId: SessionId): SkillLibraryInjected => ({
          fetchSkillLibrary: () => board.skillLibrary(),
        }),
      }, SkillLibraryView),
      // 演化台: the aggregate RSI panel (leftmost of the 演化 group). It renders
      // the 代际进化 / 战报 / 账本 panels by id through the owner's renderView, so
      // those three stay registered but drop out of the flat tab strip. Its own
      // inject face feeds the Run-RSI launcher + chain stepper at the head —
      // including submitBrief, the board Remote's one write.
      ctx.slots.register({
        name: 'conversation.view',
        id: 'rsi',
        order: 20,
        locale: NS,
        label: () => t('view.rsi'),
        inject: (_sessionId: SessionId): RsiConsoleInjected => ({
          fetchCards: () => board.cards(),
          fetchSessions: () => board.sessions(),
          fetchRuntimeStatus: (name: string) => board.runtimeStatus({ name }),
          fetchSession: (name: string) => board.session({ name }),
          fetchCampaignProgress: () => board.campaignProgress(),
          submitBrief: (briefJson: string, session: string) => board.submitBrief(briefJson, session),
        }),
      }, EvolutionConsole),
      ctx.slots.register({
        name: 'conversation.view',
        id: 'evolution',
        order: 22,
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
        id: 'cards',
        order: 23,
        locale: NS,
        label: () => t('view.cards'),
        inject: (_sessionId: SessionId): CardsInjected => ({
          fetchCards: () => board.cards(),
        }),
      }, CardsView),
      ctx.slots.register({
        name: 'conversation.view',
        id: 'ledger',
        order: 24,
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
