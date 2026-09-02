// @vitest-environment jsdom
/**
 * The 技能库 page over a fixture fold of the five-kind graph: the class tree
 * groups library skills (IN_CLASS) with kind mark + k/n; the benchmark filter
 * narrows to skills EVIDENCED_ON it; selecting a skill shows its contract,
 * bindings, evidence, and dependency links; a dependency link navigates; a
 * package detail shows the card's manifest fields; the canvas receives the
 * selection's neighborhood. The React Flow canvas is stubbed (jsdom has no
 * ResizeObserver); its fold is covered by lr-layout.client.spec.ts.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { classTree, indexGraph, neighborhood } from '../src/client/graph.ts'
import type { VaultGraph } from '../src/client/graph.ts'
import { en } from '../src/client/locales.ts'

vi.mock('../src/client/VaultGraphCanvas.tsx', () => ({
  KindGlyph: () => null,
  VaultGraphCanvas: ({ graph, selected, onSelect }: { graph: VaultGraph; selected: string | null; onSelect: (id: string) => void }) => (
    <div data-testid="canvas" data-selected={selected ?? ''} data-nodes={graph.nodes.map(n => n.id).join(' ')}>
      {graph.nodes.map(n => <button key={n.id} type="button" data-testid={`gn:${n.id}`} onClick={() => { onSelect(n.id) }}>{n.id}</button>)}
    </div>
  ),
}))

const { VaultView } = await import('../src/client/VaultView.tsx')

afterEach(cleanup)

const ok = (value: unknown): RemoteResult<unknown> => ({ ok: true, value })
const t = (key: keyof typeof en) => en[key]

const GRAPH: VaultGraph = {
  schema_version: 2,
  nodes: [
    { kind: 'benchmark', id: 'benchmark:kitchen', name: 'kitchen', embodiment: 'robocasa', tasks: ['kitchen_thaw'], card: 'plugins/robocasa' },
    { kind: 'benchmark', id: 'benchmark:lab', name: 'lab', embodiment: 'so101', tasks: [] },
    { kind: 'capability', id: 'cap.sim', privileged: true },
    { kind: 'class', id: 'class:grasp', name: 'grasp', skills: 2 },
    { kind: 'class', id: 'class:nav', name: 'nav', skills: 1 },
    { kind: 'package', id: 'plugins/robocasa', name: 'robocasa', provides: ['cap.sim'], binds: { tasks: ['kitchen_thaw'], campaigns: [] }, bundles: ['sim'], actuation: 'sim', needs_sim: true, third_party: ['robocasa'], enabled: true },
    { kind: 'skill', id: 'skill:grasp_can', status: 'library', name: 'grasp_can', skill_kind: 'segment', class: 'grasp',
      description: 'Grasp the can', args: { target: 'obj' }, requires: ['near(target)'], ensures: ['held(target)'], clobbers: ['gripper'],
      limits: { max_steps: 300 }, failure_modes: ['reach_stall'],
      bindings: { robocasa: { pi05: { transport: 'zmq', ref: 'plugins.robocasa.pi05:make', checkpoint_sha: 'abcdef0123456789' }, scripted: { transport: 'inproc', ref: 'plugins.robocasa.grasp:make' } } },
      evidence: { robocasa: { n: 9, k: 5, by_executor: { pi05: { n: 2, k: 1 }, scripted: { n: 7, k: 4 } } } } },
    { kind: 'skill', id: 'skill:grasp_cup', status: 'library', name: 'grasp_cup', skill_kind: 'segment', class: 'grasp', requires: [], ensures: ['held(cup)'], bindings: { so101: { scripted: { transport: 'inproc', ref: 'x' } } }, evidence: {} },
    { kind: 'skill', id: 'skill:nav_fridge', status: 'library', name: 'nav_fridge', skill_kind: 'segment', class: 'nav', requires: [], ensures: ['near(target)'], bindings: { robocasa: { scripted: { transport: 'inproc', ref: 'y' } } }, evidence: { robocasa: { n: 3, k: 3 } } },
    { kind: 'skill', id: 'sha-legacy', status: 'promoted', task: 'stack', label: 'legacy stack' },
  ],
  edges: [
    { rel: 'BOUND_TO', src: 'skill:grasp_can', dst: 'plugins/robocasa', rule: 'bindings ref module -> card dir', via: 'r' },
    { rel: 'DEPENDS_ON', src: 'skill:grasp_can', dst: 'skill:nav_fridge', rule: 'requires∩ensures', via: 'skill-library/records/grasp_can.json' },
    { rel: 'EVIDENCED_ON', src: 'skill:grasp_can', dst: 'benchmark:kitchen', rule: 'harness.protocol.skill_benchmarks', via: 'r', n: 9, k: 5 },
    { rel: 'EVIDENCED_ON', src: 'skill:nav_fridge', dst: 'benchmark:kitchen', rule: 'harness.protocol.skill_benchmarks', via: 'r', n: 3, k: 3 },
    { rel: 'IN_CLASS', src: 'skill:grasp_can', dst: 'class:grasp', rule: 'declared class', via: 'r' },
    { rel: 'IN_CLASS', src: 'skill:grasp_cup', dst: 'class:grasp', rule: 'declared class', via: 'r' },
    { rel: 'IN_CLASS', src: 'skill:nav_fridge', dst: 'class:nav', rule: 'declared class', via: 'r' },
    { rel: 'PROVIDES', src: 'plugins/robocasa', dst: 'cap.sim', rule: 'r', via: 'v' },
    { rel: 'REQUIRES', src: 'sha-legacy', dst: 'cap.sim', rule: 'r', via: 'v' },
  ],
}

function mount() {
  const props = { fetchVault: vi.fn(() => Promise.resolve(ok(GRAPH))), t }
  const out = render(<VaultView {...(props as unknown as Parameters<typeof VaultView>[0])} />)
  return { ...out, props }
}

describe('graph index', () => {
  const idx = indexGraph(GRAPH)

  it('groups library skills under their class and parks legacy nodes in one trailing section', () => {
    const tree = classTree(idx, { benchmark: '', embodiment: '', search: '' })
    expect(tree.classes.map(c => [c.node.id, c.skills.map(s => s.name)])).toEqual([
      ['class:grasp', ['grasp_can', 'grasp_cup']], ['class:nav', ['nav_fridge']],
    ])
    expect(tree.legacy.map(n => n.id)).toEqual(['sha-legacy', 'plugins/robocasa', 'cap.sim'])
  })

  it('narrows by benchmark (EVIDENCED_ON) and by embodiment (bindings key)', () => {
    const byBench = classTree(idx, { benchmark: 'benchmark:kitchen', embodiment: '', search: '' })
    expect(byBench.classes.map(c => c.skills.map(s => s.name))).toEqual([['grasp_can'], ['nav_fridge']])
    const byEmb = classTree(idx, { benchmark: '', embodiment: 'so101', search: '' })
    expect(byEmb.classes.map(c => [c.node.id, c.skills.map(s => s.name)])).toEqual([['class:grasp', ['grasp_cup']]])
  })

  it('draws a class with its skills and their typed neighbors, a library skill with its direct neighbors', () => {
    const cls = neighborhood(GRAPH, idx, 'class:grasp')
    expect(cls.nodes.map(n => n.id)).toEqual([
      'benchmark:kitchen', 'class:grasp', 'plugins/robocasa', 'skill:grasp_can', 'skill:grasp_cup', 'skill:nav_fridge',
    ])
    expect(cls.edges.every(e => cls.nodes.some(n => n.id === e.src) && cls.nodes.some(n => n.id === e.dst))).toBe(true)
    const nav = neighborhood(GRAPH, idx, 'skill:nav_fridge')
    // depth 1 only: grasp_can (depends on it), kitchen, class:nav — not grasp_can's card or class.
    expect(nav.nodes.map(n => n.id)).toEqual(['benchmark:kitchen', 'class:nav', 'skill:grasp_can', 'skill:nav_fridge'])
    expect(neighborhood(GRAPH, idx, null)).toBe(GRAPH)
  })
})

describe('VaultView', () => {
  it('renders the class tree with counts, expands a class to its skills with k/n, and filters by benchmark', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('grasp')).toBeTruthy() })
    expect(screen.getByText('· 2')).toBeTruthy()
    expect(screen.getByText('· 1')).toBeTruthy()
    expect(screen.getByText(en['tree.legacy'])).toBeTruthy()
    expect(screen.queryByText('grasp_can')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: `grasp: ${en['pane.expand']}` }))
    expect(screen.getByText('grasp_can')).toBeTruthy()
    expect(screen.getByText('5/9')).toBeTruthy()
    expect(screen.getByText('grasp_cup')).toBeTruthy()
    // Benchmark filter keeps only skills EVIDENCED_ON it; a class with no survivor drops.
    fireEvent.change(screen.getByLabelText(en['filter.benchmark']), { target: { value: 'benchmark:kitchen' } })
    expect(screen.getByText('grasp_can')).toBeTruthy()
    expect(screen.queryByText('grasp_cup')).toBeNull()
    fireEvent.change(screen.getByLabelText(en['filter.embodiment']), { target: { value: 'so101' } })
    expect(screen.queryByText('grasp_can')).toBeNull()
    expect(screen.queryByText('nav')).toBeNull()
  })

  it('selecting a skill shows contract, bindings, evidence, dependencies; a dependency link navigates', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('grasp')).toBeTruthy() })
    expect(screen.getByText(en['detail.none'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: `grasp: ${en['pane.expand']}` }))
    fireEvent.click(screen.getByText('grasp_can'))
    // Title + class chip + description.
    expect(screen.getByRole('heading', { name: 'grasp_can' })).toBeTruthy()
    expect(screen.getByText('Grasp the can')).toBeTruthy()
    // Contract chips.
    expect(screen.getByText('near(target)')).toBeTruthy()
    expect(screen.getByText('held(target)')).toBeTruthy()
    expect(screen.getByText('gripper')).toBeTruthy()
    // Bindings table: embodiment · executor · transport · ref · sha8.
    expect(screen.getAllByText('pi05')).toHaveLength(2)
    expect(screen.getByText('zmq')).toBeTruthy()
    expect(screen.getByText('plugins.robocasa.pi05:make')).toBeTruthy()
    expect(screen.getByText('abcdef01')).toBeTruthy()
    // Evidence: whole-record and per-executor rows.
    expect(screen.getAllByText('5/9').length).toBeGreaterThan(0)
    expect(screen.getByText('1/2')).toBeTruthy()
    expect(screen.getByText('4/7')).toBeTruthy()
    expect(screen.getByText('reach_stall')).toBeTruthy()
    // Dependency out-link carries the rule; the card and benchmark links show.
    expect(screen.getByText(en['dep.out'])).toBeTruthy()
    const dep = screen.getByTitle('requires∩ensures · skill-library/records/grasp_can.json')
    expect(dep.textContent).toContain('nav_fridge')
    // 'kitchen' is the benchmark filter option and the benchmark link.
    expect(screen.getAllByText('kitchen')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'robocasa' })).toBeTruthy()
    // The canvas draws the selection's neighborhood and marks the selection.
    const canvas = screen.getByTestId('canvas')
    expect(canvas.getAttribute('data-selected')).toBe('skill:grasp_can')
    expect(canvas.getAttribute('data-nodes')).toContain('skill:nav_fridge')
    // Following the dependency selects nav_fridge: detail, tree (its class opens), and canvas follow.
    fireEvent.click(dep)
    expect(screen.getByRole('heading', { name: 'nav_fridge' })).toBeTruthy()
    expect(screen.getByText(en['dep.in'])).toBeTruthy()
    expect(screen.getByTestId('canvas').getAttribute('data-selected')).toBe('skill:nav_fridge')
    expect(screen.getAllByText('nav_fridge').length).toBeGreaterThanOrEqual(2)
    // A canvas click selects too (bidirectional).
    fireEvent.click(screen.getByTestId('gn:class:nav'))
    expect(screen.getByRole('heading', { name: 'nav' })).toBeTruthy()
    expect(screen.getByText(en['class.benchmarks'])).toBeTruthy()
  })

  it('shows a card manifest as the package detail and a benchmark page with its covered skills', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('grasp')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: `${en['tree.legacy']}: ${en['pane.expand']}` }))
    fireEvent.click(screen.getByRole('button', { name: 'robocasa' }))
    expect(screen.getByRole('heading', { name: 'robocasa' })).toBeTruthy()
    expect(screen.getAllByText('sim')).toHaveLength(2) // actuation badge + bundle tag
    expect(screen.getByText('needs_sim')).toBeTruthy()
    expect(screen.getByText('kitchen_thaw')).toBeTruthy()
    expect(screen.getByText(en['node.bundles'])).toBeTruthy()
    expect(screen.getAllByText('cap.sim').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('BOUND_TO')).toBeTruthy()
    fireEvent.click(screen.getByTestId('gn:benchmark:kitchen'))
    expect(screen.getByRole('heading', { name: 'kitchen' })).toBeTruthy()
    expect(screen.getByText(`${en['bench.embodiment']}: robocasa`)).toBeTruthy()
    expect(screen.getByText('3/3')).toBeTruthy()
  })

  it('folds a failed read to the offline state', async () => {
    const props = { fetchVault: vi.fn(() => Promise.resolve({ ok: false, error: { message: 'no bridge' } } as unknown as RemoteResult<unknown>)), t }
    render(<VaultView {...(props as unknown as Parameters<typeof VaultView>[0])} />)
    await waitFor(() => { expect(screen.getByText(`${en.unavailable} — no bridge`)).toBeTruthy() })
  })
})
