/** The model discovery Remote forwards only the fixed storecli command and its JSON. */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BoardBridge from '../src/index.ts'

const { execFileAsync } = vi.hoisted(() => ({ execFileAsync: vi.fn() }))
vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  execFile: Object.assign(vi.fn(), { [Symbol.for('nodejs.util.promisify.custom')]: execFileAsync }),
}))

const contexts: Context[] = []
afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  vi.resetAllMocks()
})

describe('rsiModelOptions', () => {
  it('preserves discovery defaults and failure details without starting a run', async () => {
    const value = { default_model: 'configured-model', default_effort: 'off', models: [], efforts: ['off', 'low', 'high', 'max'], error: 'provider unavailable' }
    execFileAsync.mockResolvedValue({ stdout: JSON.stringify(value) })
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(BoardBridge, { pythonPath: '/python', repoRoot: '/harness', runsDir: '/runs' })
    expect(await ctx.get('board')!.rsiModelOptions()).toEqual(value)
    expect(execFileAsync).toHaveBeenCalledExactlyOnceWith('/python', ['-m', 'board.storecli', 'rsi_model_options', '--runs', '/runs'], { cwd: '/harness', maxBuffer: 64 * 1024 * 1024 })
  })
})
