// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { SkillLibraryView } from '../src/client/SkillLibraryView.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const fixture = {
  summary: { graph_skills: 2, graph_directly_bound: 0, graph_unbound: 2, runtime_skills: 1, task_bindings: 1 },
  provenance: { episodes_analyzed: 514 },
  graph: {
    root: 'concept:RobotSkill',
    nodes: [
      { id: 'concept:RobotSkill', name: 'RobotSkill', kind: 'root', parent: null, taxonomy_path: ['RobotSkill'], graph_executable: false },
      { id: 'concept:CompositeSkill', name: 'CompositeSkill', kind: 'category', parent: 'concept:RobotSkill', taxonomy_path: ['RobotSkill', 'CompositeSkill'], graph_executable: false },
      { id: 'skill:CoffeeSetupMug', name: 'CoffeeSetupMug', kind: 'observed_skill', parent: 'concept:CompositeSkill', taxonomy_path: ['RobotSkill', 'CompositeSkill', 'CoffeeSetupMug'], graph_executable: true, bound: false, binding_tasks: [], implementation_candidates: [], decomposition: ['Pick', 'Place'], stages: [{ stage: 'pick', realizes: 'Pick' }, { stage: 'place', realizes: 'Place' }], evidence: { datasets: ['PrepareCoffee'], instructions: [{ text: 'pick up the mug', count: 514 }], frames: 182257 } },
      { id: 'concept:Pick', name: 'Pick', kind: 'canonical_skill', parent: 'concept:CompositeSkill', taxonomy_path: ['RobotSkill', 'CompositeSkill', 'Pick'], graph_executable: true, bound: false, binding_tasks: [], implementation_candidates: ['pick'], decomposition: [], stages: [] },
    ],
    recipes: [{ skill: 'CoffeeSetupMug', steps: ['Pick', 'Place'] }],
  },
  runtime_skills: [{ name: 'pick', canonical: 'Pick', bindings: [{ task: 'pack_all_robocasa', policy: 'plugins.driver:provider', args: { object: 'str' } }] }],
}

const ok = (value: unknown): RemoteResult<unknown> => ({ ok: true, value })
const t = (key: keyof typeof en) => en[key]

function renderView(fetchSkillLibrary = vi.fn(() => Promise.resolve(ok(fixture)))) {
  const props = { fetchSkillLibrary, t }
  render(<SkillLibraryView {...(props as unknown as Parameters<typeof SkillLibraryView>[0])} />)
  return fetchSkillLibrary
}

describe('SkillLibraryView', () => {
  it('loads the unified tree and shows annotation facts without claiming a binding', async () => {
    const fetch = renderView()
    await waitFor(() => { expect(screen.getByText('CoffeeSetupMug')).toBeTruthy() })
    expect(fetch).toHaveBeenCalledTimes(1)
    const overall = screen.getByLabelText(en['library.overallGraph'])
    expect(overall.textContent).toContain('RobotSkill')
    expect(overall.textContent).toContain('CompositeSkill')
    expect(within(overall).getByText(en['library.graphSource'])).toBeTruthy()
    expect(screen.getByText('2', { selector: 'strong' })).toBeTruthy()
    fireEvent.click(screen.getByText('CoffeeSetupMug'))
    expect(screen.getByText('RobotSkill › CompositeSkill › CoffeeSetupMug')).toBeTruthy()
    expect(screen.getByText('pick → Pick')).toBeTruthy()
    expect(screen.getByText('Pick → Place')).toBeTruthy()
    expect(screen.getByText(en['library.noDirectBinding'])).toBeTruthy()
    expect(screen.getByText('PrepareCoffee')).toBeTruthy()
    expect(screen.getByText('pick up the mug × 514')).toBeTruthy()
  })

  it('switches between the visual overall graph and compact outline tree', async () => {
    renderView()
    await waitFor(() => { expect(screen.getByLabelText(en['library.overallGraph'])).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en['library.outlineTree'] }))
    expect(screen.getByLabelText(en['library.outlineTree'])).toBeTruthy()
    expect(screen.getByText('CoffeeSetupMug')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['library.overallGraph'] }))
    expect(screen.getByLabelText(en['library.overallGraph'])).toBeTruthy()
  })

  it('searches the taxonomy and switches to real runtime bindings', async () => {
    renderView()
    await waitFor(() => { expect(screen.getByText('CoffeeSetupMug')).toBeTruthy() })
    fireEvent.change(screen.getByLabelText(en['library.search']), { target: { value: 'missing skill' } })
    expect(screen.getByText(en['library.noMatch'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['library.runtime'] }))
    fireEvent.change(screen.getByLabelText(en['library.search']), { target: { value: 'pack_all' } })
    expect(screen.getByText('pick')).toBeTruthy()
    expect(screen.getByText('pack_all_robocasa')).toBeTruthy()
    expect(screen.getByText('plugins.driver:provider')).toBeTruthy()
  })

  it('folds a failed board read into the unavailable state', async () => {
    renderView(vi.fn(() => Promise.resolve({ ok: false, error: { message: 'offline' } } as RemoteResult<unknown>)))
    await waitFor(() => { expect(screen.getByText(`${en.unavailable} — offline`)).toBeTruthy() })
  })
})
