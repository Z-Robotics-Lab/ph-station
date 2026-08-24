/**
 * Browser 实验台 dashboard plugin: one conversation.view entry (id `dash`,
 * order -20 so it is the leftmost tab and the session's default first screen)
 * that hosts a dockview drag-composable panel grid. It reuses the SAME
 * conversation.view ledger the tab strip reads and renders each view through
 * the authorized `renderSlot`, so no existing panel is rewritten. Renders only.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'conversation.view' SlotMap row owned by the conversation package.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { en, NS, zh } from './locales.ts'
import { DashView, type DashInjected, type DashViewTab } from './DashView.tsx'
import dockviewBase from './dockview.css?inline'
import dockviewPh from './dockview-ph.css?inline'

const PLUGIN_ID = '@deepseek-ai/dsh-client-ui-ph-dash'

/** Required services: the conversation slot ledger and the copy. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: mount dockview's stylesheet + the PH tint for the plugin
 * lifetime (the ui-theme `?inline` channel) and register the 实验台 dashboard
 * view that docks every other conversation.view.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const tags = [dockviewBase, dockviewPh].map((text) => {
      const tag = document.createElement('style')
      tag.dataset.plugin = PLUGIN_ID
      tag.textContent = text
      document.head.appendChild(tag)
      return tag
    })
    return () => { for (const tag of tags) tag.remove() }
  }, 'ui-ph-dash: dockview stylesheet')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-ph-dash: dictionaries')
  const t = ctx.locale.bind(NS)

  // The view ledger the dashboard docks: the same conversation.view entries the
  // tab strip lists, read live from the slot registry (§2.2 — one ledger).
  const views: DashInjected['views'] = {
    list: (): DashViewTab[] => {
      const tabs: DashViewTab[] = []
      for (const entry of ctx.slots.entries('conversation.view')) {
        if (entry.options.id === undefined) continue
        tabs.push({ id: entry.options.id, label: resolveSlotLabel(entry.options.label) ?? entry.options.id })
      }
      return tabs
    },
    subscribe: (fn: () => void) => ctx.slots.subscribe('conversation.view', fn),
    version: () => ctx.slots.getVersion('conversation.view'),
  }

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'dash',
    order: -20,
    locale: NS,
    label: () => t('view.dash'),
    children: { 'conversation.view': { kind: 'list', scope: 'session' } },
    inject: (_sessionId: SessionId): DashInjected => ({ views }),
  }, DashView))
}
