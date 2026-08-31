/** Unit coverage for the planner's pure half: request assembly over the real
 * skill-index shape, and tolerant parsing of the model's JSON reply. */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildMessages, parsePlan, SYSTEM_PROMPT } from '../src/planner.ts'
import type { SkillIndex } from '../src/types.ts'

const index = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/skill_index.json', import.meta.url)), 'utf8'),
) as SkillIndex

describe('buildMessages', () => {
  it('carries the skill index and mission, and omits the failures block on the first turn', () => {
    const msgs = buildMessages(index, 'stack the block', [])
    expect(msgs[0]?.content).toBe(SYSTEM_PROMPT)
    expect(msgs[1]?.content).toContain('"navigate"')
    expect(msgs[1]?.content).toContain('stack the block')
    expect(msgs[1]?.content).not.toContain('PRIOR FAILED ATTEMPTS')
  })

  it('appends prior failures on a replan turn', () => {
    const msgs = buildMessages(index, 'stack', [{ task: 'carry', status: { state: 'failed' } }])
    expect(msgs[1]?.content).toContain('PRIOR FAILED ATTEMPTS')
    expect(msgs[1]?.content).toContain('carry')
  })
})

describe('parsePlan', () => {
  it('parses a well-formed plan and clamps the replan budget to 3', () => {
    const plan = parsePlan(JSON.stringify({
      steps: [{ task: 'navigate', executor: 'navdigest01', seed: 420001, max_replans: 9, max_actuations: 40, rationale: 'go' }],
      flags: ['heads up'],
      note: 'ok',
    }))
    expect(plan.error).toBeUndefined()
    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]?.max_replans).toBe(3)
    expect(plan.steps[0]?.executor).toBe('navdigest01')
    expect(plan.flags).toEqual(['heads up'])
  })

  it('keeps a null executor (the flag-to-operator decision) and drops nameless steps', () => {
    const plan = parsePlan(JSON.stringify({
      steps: [
        { task: 'place', executor: null, seed: 1, max_replans: 0, max_actuations: 1, rationale: 'unreliable' },
        { executor: 'x', seed: 1, max_replans: 0, max_actuations: 1 },
      ],
      flags: [],
      note: '',
    }))
    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]?.executor).toBeNull()
  })

  it('tolerates a fenced code block around the JSON', () => {
    const plan = parsePlan('```json\n{"steps":[],"flags":[],"note":"n"}\n```')
    expect(plan.error).toBeUndefined()
    expect(plan.note).toBe('n')
  })

  it('reports an error plan for unparseable output rather than throwing', () => {
    expect(parsePlan('not json').error).toBe('unparseable-plan')
    expect(parsePlan('{"note":"x"}').error).toBe('malformed-plan')
  })
})
