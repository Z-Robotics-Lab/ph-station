// @vitest-environment jsdom
/**
 * Registration contract: the panels package fills `conversation.view` with the
 * legacy strict launcher ('rsi-strict', embedded by the unified RSI page in
 * ui-ph-ops) plus 迭代记录 / 能力卡 / 账本 — never the old 'rsi' aggregate — and
 * empties every hole when its fiber goes down.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { en, zh } from '../src/client/locales.ts'

const HOLES = ['conversation.view', 'shell.overlay', 'conversation.input.dock'] as const

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('locale', new LocaleRuntime(ctx))
  ctx.provide('remote', { board: {} } as never)
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({
    name: 'root',
    children: Object.fromEntries(HOLES.map(name => [name, { kind: 'list', scope: 'root' }])),
  } as never, () => null)
  return { ctx, slots }
}

describe('ui-ph-panels registrations', () => {
  it('declares the services it drives', () => {
    expect(inject).toEqual(['slots', 'remote', 'remote.board', 'locale'])
  })

  it('registers rsi-strict + the legacy panels, not an rsi aggregate, and leaves with its fiber', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: ['slots', 'locale'], apply })
    await fiber.await()
    const views = b.slots.entries('conversation.view')
    const ids = views.map(e => e.options.id)
    expect(ids).toEqual(['rsi-strict', 'evolution', 'cards', 'ledger'])
    expect(ids).not.toContain('rsi')
    // Whichever locale the browser pins, the label is the strict launcher's.
    expect([zh['view.rsiStrict'], en['view.rsiStrict']]).toContain((views[0]!.options.label as () => string)())
    for (const hole of HOLES) expect(b.slots.entries(hole).length).toBeGreaterThan(0)
    await fiber.dispose()
    for (const hole of HOLES) expect(b.slots.entries(hole)).toHaveLength(0)
  })
})
