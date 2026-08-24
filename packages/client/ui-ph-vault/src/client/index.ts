/**
 * Browser 技能库 (Skill Vault) plugin: one entry in the conversation view slot
 * that renders the deterministic wiki graph over the harness's sealed skills,
 * packages, and capabilities (board.vault). Renders only — every node, edge,
 * status, and number comes verbatim from the board vault fold.
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
import { VaultView, type VaultInjected } from './VaultView.tsx'
import xyflowBase from './xyflow-base.css?inline'

const PLUGIN_ID = '@deepseek-ai/dsh-client-ui-ph-vault'

/* jscpd:ignore-start -- the React-Flow `?inline` stylesheet-mount + locale
   registration is the identical per-package boilerplate ui-ph-livegraph runs;
   the two graph panels share the mount idiom, not extractable logic. */
/** Required services: the conversation slot, the board Remote namespace, the copy. */
export const inject = ['slots', 'remote', 'remote.board', 'locale']

/**
 * Client plugin body: mount React Flow's structural stylesheet for the plugin
 * lifetime (the ui-theme `?inline` channel) and register the 技能库 view tab.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = PLUGIN_ID
    tag.textContent = xyflowBase
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'ui-ph-vault: xyflow base stylesheet')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-ph-vault: dictionaries')
  /* jscpd:ignore-end */
  const t = ctx.locale.bind(NS)
  const board = ctx.remote.board

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'vault',
    order: 28,
    locale: NS,
    label: () => t('view.vault'),
    inject: (_sessionId: SessionId): VaultInjected => ({
      fetchVault: () => board.vault(),
    }),
  }, VaultView))
}
