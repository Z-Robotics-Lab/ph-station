import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { boot, healProfilesModuleFallback, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { provideCmdline } from '@deepseek-ai/dsh-cmdline'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// Type-only: resolves `ctx.get('webServer')`.
import type {} from '@deepseek-ai/dsh-host-webserver'

/**
 * The 演化/技能 board faces over a REAL web boot: the shipped Web composition
 * listening on a loopback port, its `board-bridge` row pointed at a harness
 * checkout, and plain HTTP POSTs against `/api/board/<method>` the way the
 * browser panels issue them. The bridge locates the harness exactly as the
 * deploy overlay does (`PH_BOARD_REPO` / `PH_BOARD_PYTHON`, forwarded as the
 * row's `repoRoot` / `pythonPath`), so the storecli under test is the one the
 * operator's cockpit would spawn; without `PH_BOARD_REPO` the file self-skips
 * like every other keyless-CI e2e. `runsDir` is a fixture under this test's
 * tmp: a session with a spec-shaped `campaign.json` and an empty inbox, so
 * nothing here reads or writes a production `runs/`.
 */

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const CONFIG_DIR = fileURLToPath(new URL('../config/', import.meta.url))
const BASE_PATCH = join(REPO_ROOT, 'packages/bundle/base/cordis.patch.yml')
const WEB_PATCH = join(REPO_ROOT, 'packages/bundle/web-app/cordis.patch.yml')
const INSTALL_ANCHOR = join(REPO_ROOT, 'apps/cli/package.json')
const DIST_INDEX = join(REPO_ROOT, 'apps/web/dist/index.html')

const harnessRepo = process.env.PH_BOARD_REPO
const harnessPython = process.env.PH_BOARD_PYTHON ?? 'python3'
const storecli = harnessRepo === undefined ? undefined : join(harnessRepo, 'board', 'storecli.py')
const runnable = storecli !== undefined && existsSync(storecli) && existsSync(DIST_INDEX)

const CAMPAIGN = {
  task: 'kitchen_thaw', session: 'session-main', seeds: [1, 2], arm: 'auto',
  rounds: [
    { round: 1, tried: { kind: 'executor', node: 'grasp', detail: 'scripted->geometric' },
      before: 0, after: 1, best: 1, suite_sha: 'a'.repeat(64), published: true,
      // Trail nodes carry `task`: rsiSeries derives node_rate / by_task off them.
      per_seed: [
        { seed: 1, success: false, first_death: 'grasp', failure_mode: 'reach_stall', nodes: [{ id: 'reach', task: 'reach', ok: true }, { id: 'grasp', task: 'grasp', ok: false }] },
        { seed: 2, success: true, first_death: null, failure_mode: null, nodes: [{ id: 'reach', task: 'reach', ok: true }, { id: 'grasp', task: 'grasp', ok: true }] },
      ],
      media: ['media/kitchen_thaw/1/grasp.gif'], ts: 1.0 },
    { round: 2, tried: { kind: 'tunables', node: 'grasp', detail: 'hover_z*1.2' },
      before: 1, after: 1, best: 1, suite_sha: 'b'.repeat(64), published: false,
      media: [], ts: 2.0 },
  ],
  best: 1, cursor: 2, status: 'running',
}

async function fixtureRuns(root: string): Promise<string> {
  const runs = join(root, 'runs')
  const session = join(runs, 'session-main')
  await mkdir(join(session, 'session-log'), { recursive: true })
  await writeFile(join(session, 'session-log', 'rows.jsonl'), '')
  await mkdir(join(session, 'inbox'), { recursive: true })
  const campaign = join(session, 'campaigns', 'evolve-kitchen_thaw')
  await mkdir(campaign, { recursive: true })
  await writeFile(join(campaign, 'campaign.json'), JSON.stringify(CAMPAIGN))
  const clip = join(session, 'media', 'kitchen_thaw', '1')
  await mkdir(clip, { recursive: true })
  await writeFile(join(clip, 'grasp.gif'), GIF)
  return runs
}

/** The fixture clip's bytes (a GIF header is enough: the route streams, never decodes). */
const GIF = Buffer.from('GIF89a\0\0\0\0\0\0;', 'latin1')

async function bootWeb(home: string, runsDir: string): Promise<Context> {
  const settingsFile = join(home, 'settings.yaml')
  await writeFile(settingsFile, '{}\n')
  const overrides: PatchOptions[] = [
    { id: 'settings', config: { path: settingsFile, watch: false } },
    { id: 'storage-json', config: { root: join(home, 'storages') } },
    // A real listening socket on an OS-assigned port; the runtime row serves
    // the built dist but neither prints the URL nor opens a browser.
    { id: 'webserver', config: { host: '127.0.0.1', port: 0 } },
    { id: 'web-runtime', config: { openBrowser: false, printUrl: false, surfaceContext: true } },
    { id: 'session-telemetry-otel', disabled: true },
    { id: 'llm-deepseek', disabled: true },
    { id: 'directory-picker', disabled: true },
    { insert: [
      { id: 'directory-picker-browse', name: '@deepseek-ai/dsh-host-directory-picker-browse' },
      { id: 'ui-directory-picker-browse', name: '@deepseek-ai/dsh-client-ui-directory-picker-browse' },
    ] },
    {
      id: 'agent-presets',
      config: {
        default: 'standard',
        roots: [{ path: join(CONFIG_DIR, 'agent-presets'), trust: 'system' }],
        includeUserRoot: false,
      },
    },
    // The fork-only row, enabled the way the deploy overlay enables it.
    {
      id: 'board-bridge',
      disabled: false,
      config: { pythonPath: harnessPython, repoRoot: harnessRepo, runsDir },
    },
  ]
  healProfilesModuleFallback(INSTALL_ANCHOR, home)
  const profileDir = join(home, 'profiles', 'spec')
  await mkdir(profileDir, { recursive: true })
  const rootConfig = join(profileDir, 'cordis.yml')
  await writeFile(rootConfig, '[]\n')
  const patches = [...loadOverlayPatches('dsh-test', BASE_PATCH), ...loadOverlayPatches('dsh-test', WEB_PATCH)]
  return await boot('dsh-test', rootConfig, [...patches, ...overrides], (bootCtx) => {
    provideCmdline(bootCtx, { args: [], exit: () => {} })
  })
}

interface RpcReply {
  result: { ok: true; value: unknown } | { ok: false; error: unknown }
}

/** POST one board Remote the way the browser's typert client does; the RPC result, ok or not. */
async function rpc(base: string, method: string, args: Record<string, unknown>): Promise<RpcReply['result']> {
  const response = await fetch(`${base}/api/board/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: `t-${method}`, method: `board/${method}`, payload: { args } }),
  })
  expect(response.status, `${method}: ${await response.clone().text()}`).toBe(200)
  return (await response.json() as RpcReply).result
}

async function board(base: string, method: string, args: Record<string, unknown>): Promise<unknown> {
  const result = await rpc(base, method, args)
  if (!result.ok) throw new Error(`${method} failed: ${JSON.stringify(result.error)}`)
  return result.value
}

describe.skipIf(!runnable)('board bridge over a real web boot', () => {
  let ctx: Context
  let base: string
  let runs: string

  beforeAll(async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-ph-board-evolve-'))
    runs = await fixtureRuns(home)
    ctx = await bootWeb(home, runs)
    const port = ctx.get('webServer')?.port
    if (port === undefined) throw new Error('web boot bound no port')
    base = `http://127.0.0.1:${String(port)}`
  }, 120_000)

  afterAll(async () => {
    await ctx?.fiber.dispose()
  })

  it('serves the skills overview from the harness records', async () => {
    const rows = await board(base, 'skills', { request: { name: 'session-main' } }) as Array<Record<string, unknown>>
    expect(Array.isArray(rows) && rows.length > 0).toBe(true)
    const row = rows[0] as Record<string, unknown>
    expect(Object.keys(row).sort()).toEqual(
      ['bindings', 'description', 'evidence', 'failure_modes', 'kind', 'limits', 'name', 'source'],
    )
    expect(row.source).toBe('library')
    // storecli's safe_child guard refuses a traversal name (non-zero exit -> failed RPC).
    expect((await rpc(base, 'skills', { request: { name: '../x' } })).ok).toBe(false)
  })

  it('serves rsiRun and rsiSeries verbatim from the fixture campaign', async () => {
    const run = await board(base, 'rsiRun', { request: { session: 'session-main', task: 'kitchen_thaw' } }) as Record<string, unknown>
    // toMatchObject: the harness adds a `live` progress block the fixture does not write.
    expect(run).toMatchObject({ ...CAMPAIGN, latest: CAMPAIGN.rounds[1] })
    const series = await board(base, 'rsiSeries', { request: { session: 'session-main', task: 'kitchen_thaw' } })
    expect(series).toEqual([
      { round: 1, before: 0, after: 1, best: 1, per_seed: CAMPAIGN.rounds[0]?.per_seed, needs: null,
        proposer: null, llm: null, node_rate: { before: 0.75, after: null, best: 0.75 },
        by_task: { grasp: { before: 0.5, after: null }, reach: { before: 1, after: null } } },
      { round: 2, before: 1, after: 1, best: 1, per_seed: null, needs: null,
        proposer: null, llm: null, node_rate: { before: null, after: null, best: 0.75 }, by_task: {} },
    ])
    expect(await board(base, 'rsiFrames', { request: { session: 'session-main', task: 'kitchen_thaw', round: 1 } }))
      .toEqual(['media/kitchen_thaw/1/grasp.gif'])
    expect(await board(base, 'rsiRun', { request: { session: 'session-main', task: 'nope' } })).toBeNull()
  })

  it('lists the fixture campaign through rsiCampaigns, off disk', async () => {
    expect(await board(base, 'rsiCampaigns', { request: { name: 'session-main' } })).toEqual([{
      task: 'kitchen_thaw', status: 'running', cursor: 2, rounds: 2, best: 1, seeds: [1, 2], arm: 'auto', node_rate_best: 0.75,
      updated: expect.any(Number), live: null, open_brief: null,
    }])
  })

  it('streams a kept clip through GET /api/board/media and refuses traversal', async () => {
    const hit = await fetch(`${base}/api/board/media/session-main/media/kitchen_thaw/1/grasp.gif`)
    expect(hit.status).toBe(200)
    expect(hit.headers.get('content-type')).toBe('image/gif')
    expect(Buffer.from(await hit.arrayBuffer())).toEqual(GIF)
    // Encoded-slash traversal (the URL parser leaves %2F alone, the route decodes it) and a
    // real file outside media/ both read as 404 -- the guard, not the filesystem, answers.
    const traversal = await fetch(`${base}/api/board/media/session-main/media/..%2F..%2Fsession-main/campaigns/evolve-kitchen_thaw/campaign.json`)
    expect(traversal.status).toBe(404)
    expect((await fetch(`${base}/api/board/media/session-main/campaigns/evolve-kitchen_thaw/campaign.json`)).status).toBe(404)
  })

  it('policyServer status is a read: a dict with running/serving keys', async () => {
    // `status` only — start/stop would touch the live pi0.5 server on :8000.
    const state = await board(base, 'policyServer', { action: 'status' }) as Record<string, unknown>
    expect(typeof state.running).toBe('boolean')
    expect(typeof state.serving).toBe('boolean')
  })

  it('submitBrief lands the brief JSON verbatim in the session inbox; cancelBrief marks it', async () => {
    const brief = JSON.stringify({ kind: 'evolve', task: 'kitchen_thaw' })
    const dropped = await board(base, 'submitBrief', { briefJson: brief, session: 'session-main' }) as { submitted: string; inbox: string }
    expect(dropped.inbox).toBe(join(runs, 'session-main', 'inbox'))
    expect(await readdir(dropped.inbox)).toContain(dropped.submitted)
    expect(await readFile(join(dropped.inbox, dropped.submitted), 'utf8')).toBe(brief)

    const cancelled = await board(base, 'cancelBrief', { briefId: dropped.submitted, session: 'session-main' }) as Record<string, unknown>
    expect(cancelled).toMatchObject({ brief_id: dropped.submitted, session: 'session-main', state: 'queued', requested: true })
    expect(existsSync(join(dirname(dropped.inbox), 'cancel', dropped.submitted))).toBe(true)
  })
})
