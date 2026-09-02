// @vitest-environment jsdom
/**
 * Mocked end-to-end: the panel's request goes through the real harness CLI face
 * (`python -m board.storecli plan_skill_task`, the same function the MCP tool
 * and the ph-board bridge call) with the planner pointed at a fake DeepSeek
 * server started here, so the reply is produced by the real skill-graph
 * retrieval, the real validator and the real expansion -- and the view renders
 * that reply. Skipped when the physical-harness venv or the generated unified
 * skill graph is absent. Fake vs live boundary: the model is canned and nothing
 * is submitted; the resident runtime and any policy driver are never touched.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { PlanView } from '../src/client/PlanView.tsx'
import { en } from '../src/client/locales.ts'

const HARNESS = process.env.PH_BOARD_REPO ?? resolve(import.meta.dirname, '../../../../../physical-harness')
const PYTHON = process.env.PH_BOARD_PYTHON ?? resolve(HARNESS, '.venv/bin/python')
const GRAPH = process.env.PH_UNIFIED_SKILL_GRAPH
  ?? resolve(HARNESS, '../sims/robocasa/skill_annotation_analysis/taxonomy/unified_skill_graph.json')
const available = existsSync(PYTHON) && existsSync(GRAPH) && existsSync(resolve(HARNESS, 'board/storecli.py'))

/** The canned DeepSeek reply: a legal two-composite coffee chain. */
const COFFEE_PLAN = {
  goal: 'Prepare a cup of coffee',
  nodes: [
    { id: 'setup-mug', skill: 'CoffeeSetupMug', kind: 'segment', args: {}, after: [] },
    { id: 'start-machine', skill: 'StartCoffeeMachine', kind: 'segment', args: {}, after: ['setup-mug'] },
  ],
  verify: [
    { after: 'setup-mug', predicate: 'annotation_complete' },
    { after: 'start-machine', predicate: 'annotation_complete' },
  ],
}

let server: Server | null = null
let baseUrl = ''
const requests: unknown[] = []

beforeAll(async () => {
  if (!available) return
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json')
      if (req.method === 'GET') { res.end(JSON.stringify({ data: [{ id: 'fake-deepseek' }] })); return }
      requests.push(JSON.parse(body))
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(COFFEE_PLAN) } }] }))
    })
  })
  await new Promise<void>((r) => { server!.listen(0, '127.0.0.1', () => { r() }) })
  const address = server.address()
  if (address !== null && typeof address === 'object') baseUrl = `http://127.0.0.1:${address.port}/v1`
})
afterAll(() => { server?.close() })
afterEach(cleanup)

const execFileAsync = promisify(execFile)

/** The bridge's exact call shape: storecli plan_skill_task with cwd=repo. Async,
 * so the fake model server in this process can answer the Python child. */
async function planViaHarness(instruction: string, runs: string): Promise<unknown> {
  const { stdout } = await execFileAsync(PYTHON, [
    '-m', 'board.storecli', 'plan_skill_task', '--runs', runs,
    `--instruction=${instruction}`, '--session', 'session-robocasa', '--channel=auto', '--seed', '4242',
  ], {
    cwd: HARNESS,
    env: { ...process.env, PH_PLANNER_BASE_URL: baseUrl, PH_UNIFIED_SKILL_GRAPH: GRAPH },
    encoding: 'utf8',
    timeout: 120_000,
  })
  return JSON.parse(stdout) as unknown
}

describe.skipIf(!available)('PlanView end to end through the harness CLI face', () => {
  it('UI request -> storecli -> fake DeepSeek -> graph retrieval -> validation -> expansion -> rendered chain', async () => {
    const runs = resolve(HARNESS, 'runs')
    const props = {
      planSkillTask: vi.fn(async (instruction: string) => ({ ok: true as const, value: await planViaHarness(instruction, runs) })),
      submitSkillPlan: vi.fn(() => Promise.reject(new Error('must not be called: planning-only'))),
      briefStatus: vi.fn(() => Promise.reject(new Error('unused'))),
      cancelBrief: vi.fn(() => Promise.reject(new Error('unused'))),
      t: (key: keyof typeof en) => en[key],
    }
    render(<PlanView {...(props as unknown as Parameters<typeof PlanView>[0])} />)
    fireEvent.change(screen.getByLabelText(en['plan.instructionLabel']), { target: { value: 'Prepare a cup of coffee.' } })
    fireEvent.click(screen.getByRole('button', { name: en['plan.plan'] }))
    await waitFor(() => { expect(screen.getByText(en['plan.status.planning_only'])).toBeTruthy() }, { timeout: 120_000 })

    // the fake model saw the compact catalogue with taxonomy, not the whole graph
    expect(requests.length).toBe(1)
    const userMsg = (requests[0] as { messages: { content: string }[] }).messages[1]!.content
    const payload = JSON.parse(userMsg.slice(userMsg.indexOf('{'), userMsg.lastIndexOf('}') + 1)) as { catalogue: Record<string, unknown>; taxonomy: unknown }
    expect(Object.keys(payload.catalogue)).toContain('CoffeeSetupMug')
    expect(Object.keys(payload.catalogue).length).toBeLessThan(56)
    expect(payload.taxonomy).toBeDefined()

    // what the operator sees: the expanded chain and the honest verdict
    const graph = screen.getByLabelText(en['plan.graph'])
    expect(within(graph).getAllByRole('listitem').length).toBe(2)
    expect(within(graph).getByText('CoffeeSetupMug.pick')).toBeTruthy()
    expect(within(graph).getByText('CoffeeSetupMug.place')).toBeTruthy()
    expect(within(graph).getByText('StartCoffeeMachine.execute')).toBeTruthy()
    expect(within(graph).getByText('done')).toBeTruthy()
    expect(screen.getByText(`${en['plan.missing']} (3)`)).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: en['plan.execute'] }).disabled).toBe(true)
    expect(props.submitSkillPlan).not.toHaveBeenCalled()
  }, 180_000)
})
