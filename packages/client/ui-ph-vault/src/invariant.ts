/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-ph-vault`.
 * @module @deepseek-ai/dsh-client-ui-ph-vault/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-ph-vault'

/** Cordis companion plugin name. */
export const name = 'client-ui-ph-vault-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a pure-consumer plugin — it emits no cordis events and
 * owns no mutable cross-plugin state; it fetches the board vault fold once and
 * renders, and its view-slot registration is a plain effect the slot ledger
 * observes.
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
