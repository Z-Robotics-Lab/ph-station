// @vitest-environment jsdom
/**
 * 规划 view render contract over the board.planning wire dicts. The fixtures are
 * real `plan_skill_task` replies produced by the harness pipeline with a canned
 * planner (tests/fixtures/plan-results.json): a planning-only coffee chain, an
 * executable pack_all_robocasa chain, and a validator-rejected plan. Board
 * calls are mocked at the injected face; the harness owns every verdict, this
 * file asserts only that the view shows them and never invents one.
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { PlanView, type PlanResult } from '../src/client/PlanView.tsx'
import { en } from '../src/client/locales.ts'
import fixtures from './fixtures/plan-results.json'

afterEach(cleanup)

const ok = (value: unknown): RemoteResult<unknown> => ({ ok: true, value })
const fail = (message: string): RemoteResult<unknown> =>
  ({ ok: false, error: { message } } as unknown as RemoteResult<unknown>)
const t = (key: keyof typeof en) => en[key]

type Face = {
  planSkillTask: ReturnType<typeof vi.fn>
  submitSkillPlan: ReturnType<typeof vi.fn>
  briefStatus: ReturnType<typeof vi.fn>
  cancelBrief: ReturnType<typeof vi.fn>
}

function renderView(face: Partial<Face> = {}) {
  const props: Face = {
    planSkillTask: vi.fn(() => Promise.resolve(ok(fixtures.coffee))),
    submitSkillPlan: vi.fn(() => Promise.resolve(ok({ submitted: true, brief_id: 'brief-1.json', state: 'queued', queue_position: 1 }))),
    briefStatus: vi.fn(() => Promise.resolve(ok({ state: 'running', brief_id: 'brief-1.json' }))),
    cancelBrief: vi.fn(() => Promise.resolve(ok({ requested: true, state: 'running' }))),
    ...face,
  }
  render(<PlanView {...(props as unknown as Parameters<typeof PlanView>[0])} t={t as never} />)
  return props
}

/** Type the task and press Plan. */
function submitTask(text: string) {
  fireEvent.change(screen.getByLabelText(en['plan.instructionLabel']), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: en['plan.plan'] }))
}

describe('PlanView', () => {
  it('starts idle with Plan disabled until a task is typed and Execute disabled', () => {
    renderView()
    expect(screen.getByText(en['plan.empty'])).toBeTruthy()
    const simulator = screen.getByLabelText<HTMLSelectElement>(en['plan.simulator'])
    expect(simulator.value).toBe('robocasa')
    expect(within(simulator).getByRole('option', { name: 'RoboCasa' })).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: en['plan.plan'] }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: en['plan.execute'] }).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(en['plan.instructionLabel']), { target: { value: 'Prepare a cup of coffee.' } })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: en['plan.plan'] }).disabled).toBe(false)
  })

  it('a typed task triggers planSkillTask with the text, session and seed, showing the loading state', async () => {
    let resolve!: (v: RemoteResult<unknown>) => void
    const pending = new Promise<RemoteResult<unknown>>((r) => { resolve = r })
    const props = renderView({ planSkillTask: vi.fn(() => pending) })
    submitTask('Prepare a cup of coffee.')
    expect(props.planSkillTask).toHaveBeenCalledWith('Prepare a cup of coffee.', 'session-robocasa', 424242)
    expect(screen.getAllByText(en['plan.planning']).length).toBeGreaterThan(0)
    resolve(ok(fixtures.coffee))
    await waitFor(() => { expect(screen.getByText(en['plan.status.planning_only'])).toBeTruthy() })
  })

  it('renders the planning-only coffee chain: composite nodes, expanded leaves, taxonomy, bindings, Execute disabled', async () => {
    renderView()
    submitTask('Prepare a cup of coffee.')
    await waitFor(() => { expect(screen.getByText(en['plan.status.planning_only'])).toBeTruthy() })
    const graph = screen.getByLabelText(en['plan.graph'])
    expect(within(graph).getByText('RoboCasa')).toBeTruthy()
    expect(within(graph).getByText('CoffeeSetupMug')).toBeTruthy()
    expect(within(graph).getByText('StartCoffeeMachine')).toBeTruthy()
    expect(within(graph).getByText('CoffeeSetupMug.pick')).toBeTruthy()
    expect(within(graph).getByText('CoffeeSetupMug.place')).toBeTruthy()
    expect(within(graph).getByText('StartCoffeeMachine.execute')).toBeTruthy()
    expect(within(graph).getByText('pick → Pick')).toBeTruthy()
    expect(within(graph).getByText('execute → PressButton')).toBeTruthy()
    expect(within(graph).getByText('RobotSkill › CompositeSkill › TransferObject › CoffeeSetupMug')).toBeTruthy()
    expect(within(graph).getByText('done')).toBeTruthy()
    expect(within(graph).getAllByRole('listitem').length).toBe(2)
    // missing bindings are listed, never hidden; Execute stays disabled
    expect(screen.getByText(`${en['plan.missing']} (3)`)).toBeTruthy()
    expect(screen.getByText(en['plan.planningOnlyNotice'])).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: en['plan.execute'] }).disabled).toBe(true)
    // nothing claims an execution result
    expect(screen.queryByText(en['plan.brief'])).toBeNull()
  })

  it('folds a failed or rejected board read into the error state', async () => {
    const props = renderView({ planSkillTask: vi.fn(() => Promise.resolve(fail('board bridge not mounted'))) })
    submitTask('Prepare a cup of coffee.')
    await waitFor(() => { expect(screen.getByText(`${en['plan.error']} — board bridge not mounted`)).toBeTruthy() })
    expect(props.planSkillTask).toHaveBeenCalledTimes(1)
    cleanup()
    renderView({ planSkillTask: vi.fn(() => Promise.reject(new Error('codec'))) })
    submitTask('x')
    await waitFor(() => { expect(screen.getByText(`${en['plan.error']} — codec`)).toBeTruthy() })
    cleanup()
    renderView({ planSkillTask: vi.fn(() => Promise.resolve(ok({ error: 'planner endpoint unreachable: refused', status: 'rejected' }))) })
    submitTask('x')
    await waitFor(() => { expect(screen.getByText(en['plan.status.rejected'])).toBeTruthy() })
  })

  it('shows the validator refusal verbatim for a rejected plan and keeps Execute disabled', async () => {
    renderView({ planSkillTask: vi.fn(() => Promise.resolve(ok(fixtures.rejected))) })
    submitTask('Prepare a cup of coffee.')
    await waitFor(() => { expect(screen.getByText(en['plan.status.rejected'])).toBeTruthy() })
    expect(screen.getByText(/unknown skill 'MakeEspresso'/)).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: en['plan.execute'] }).disabled).toBe(true)
    expect(screen.queryByText(en['plan.expanded'])).toBeNull()
  })

  it('enables Execute only for an executable plan, submits the harness record, then polls brief status', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const props = renderView({ planSkillTask: vi.fn(() => Promise.resolve(ok(fixtures.pack))) })
      submitTask('Pack every food item into its assigned tupperware.')
      await waitFor(() => { expect(screen.getByText(en['plan.status.executable'])).toBeTruthy() })
      const execute = screen.getByRole<HTMLButtonElement>('button', { name: en['plan.execute'] })
      expect(execute.disabled).toBe(false)
      const graph = screen.getByLabelText(en['plan.graph'])
      expect(within(graph).getAllByText(en['plan.bound']).length).toBeGreaterThanOrEqual(4)
      expect(within(graph).getAllByText('· pack_all_robocasa').length).toBe(4)
      expect(within(graph).getAllByRole('listitem')[0]?.textContent).toContain('nav_hot1')
      expect(graph.textContent).not.toContain('{"object"')
      fireEvent.click(execute)
      await waitFor(() => { expect(props.submitSkillPlan).toHaveBeenCalledTimes(1) })
      // the record the harness handed back goes back verbatim, as JSON
      const call = props.submitSkillPlan.mock.calls[0] as [string, string, number] | undefined
      if (call === undefined) throw new Error('submitSkillPlan was not called')
      const [record, session, seed] = call
      expect(JSON.parse(record) as unknown).toEqual(fixtures.pack.composite_plan)
      expect(session).toBe('session-robocasa')
      expect(seed).toBe(424242)
      await waitFor(() => { expect(screen.getByText('brief-1.json')).toBeTruthy() })
      expect(screen.getByText(en['plan.brief.queued'])).toBeTruthy()
      // Execute cannot be pressed twice for the same plan
      expect(screen.getByRole<HTMLButtonElement>('button', { name: en['plan.execute'] }).disabled).toBe(true)
      // brief_status is polled while live; the state text follows the harness
      await vi.advanceTimersByTimeAsync(2100)
      await waitFor(() => { expect(props.briefStatus).toHaveBeenCalledWith('brief-1.json', 'session-robocasa') })
      await waitFor(() => { expect(screen.getByText(en['plan.brief.running'])).toBeTruthy() })
      // cancel goes through the board's cancel_brief, nothing else
      fireEvent.click(screen.getByRole('button', { name: en['plan.cancel'] }))
      await waitFor(() => { expect(props.cancelBrief).toHaveBeenCalledWith('brief-1.json', 'session-robocasa') })
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows a refused submit as a refusal, never as an execution result', async () => {
    renderView({
      planSkillTask: vi.fn(() => Promise.resolve(ok(fixtures.pack))),
      submitSkillPlan: vi.fn(() => Promise.resolve(ok({ submitted: false, status: 'planning_only', error: 'unbound leaves: [x]' }))),
    })
    submitTask('Pack every food item into its assigned tupperware.')
    await waitFor(() => { expect(screen.getByText(en['plan.status.executable'])).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en['plan.execute'] }))
    await waitFor(() => { expect(screen.getByText(`${en['plan.submitRefused']} — unbound leaves: [x]`)).toBeTruthy() })
    expect(screen.queryByText(en['plan.brief.queued'])).toBeNull()
  })

  it('renders model text as text, never as HTML', async () => {
    const hostile = JSON.parse(JSON.stringify(fixtures.coffee)) as PlanResult
    const payload = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>'
    hostile.goal = payload
    hostile.missing_bindings![0]!.reason = `${payload} reason`
    hostile.expanded_plan!.chain![0]!.label = `${payload} label`
    hostile.composite_plan!.plan!.nodes![0]!.skill = payload
    renderView({ planSkillTask: vi.fn(() => Promise.resolve(ok(hostile))) })
    submitTask('Prepare a cup of coffee.')
    await waitFor(() => { expect(screen.getByText(en['plan.status.planning_only'])).toBeTruthy() })
    expect(document.querySelectorAll('img, script').length).toBe(0)
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
    // the literal text is what the operator sees
    expect(screen.getAllByText((_, el) => (el?.textContent ?? '').includes(payload)).length).toBeGreaterThan(0)
  })
})
