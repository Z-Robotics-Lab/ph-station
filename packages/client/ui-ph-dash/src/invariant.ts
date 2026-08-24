/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-ph-dash`.
 * @module @deepseek-ai/dsh-client-ui-ph-dash/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-ph-dash'

/** Cordis companion plugin name. */
export const name = 'client-ui-ph-dash-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a pure layout host — it emits no cordis events and owns
 * no mutable cross-plugin state. It reads the conversation.view slot ledger and
 * renders each view into a dockview panel; its own view-slot registration is a
 * plain effect the slot ledger observes, and the layout it persists is local
 * browser state, not a cross-plugin relation.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
