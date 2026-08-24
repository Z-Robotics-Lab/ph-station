/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-ph-ops`.
 * @module @deepseek-ai/dsh-client-ui-ph-ops/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-ph-ops'

/** Cordis companion plugin name. */
export const name = 'client-ui-ph-ops-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: pure-consumer surfaces — the mission cockpit and the
 * operator-rail cards emit no cordis events and own no mutable cross-plugin
 * state; they read the board Remote and render, and their slot registrations
 * are plain effects the slot ledger observes.
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
