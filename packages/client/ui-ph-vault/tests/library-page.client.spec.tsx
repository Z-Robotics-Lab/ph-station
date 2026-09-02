// @vitest-environment jsdom
/**
 * The 技能库 page over a fixture fold of the five-kind graph: the class tree
 * groups library skills (IN_CLASS) with kind mark + k/n; the benchmark filter
 * narrows to skills EVIDENCED_ON it; selecting a skill shows its contract,
 * bindings, evidence, and dependency links; a dependency link navigates; a
 * package detail shows the card's manifest fields; the canvas receives the
 * selection's neighborhood (the class overview with no selection; instances
 * collapsed under their generic until expanded). The React Flow canvas is
 * stubbed for the page tests (jsdom has no ResizeObserver); one test mounts
 * the real canvas over a mocked `@xyflow/react` to prove it refits on every
 * graph change. The layout fold is covered by lr-layout.client.spec.ts.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { classTree, indexGraph, layout, neighborhood, overview } from '../src/client/graph.ts'
import type { VaultFilters, VaultGraph } from '../src/client/graph.ts'
import { en } from '../src/client/locales.ts'

vi.mock('../src/client/VaultGraphCanvas.tsx', () => ({
  KindGlyph: () => null,
  VaultGraphCanvas: ({ graph, selected, onSelect, onToggle }: {
    graph: VaultGraph
    selected: string | null
    onSelect: (id: string) => void
    onToggle: (id: string) => void
  }) => (
    <div data-testid="canvas" data-selected={selected ?? ''} data-nodes={graph.nodes.map(n => n.id).join(' ')} data-edges={graph.edges.map(e => `${e.rel}:${e.src}>${e.dst}=${e.count ?? ''}`).join(' ')}>
      {graph.nodes.map(n => <button key={n.id} type="button" data-testid={`gn:${n.id}`} onClick={() => { onSelect(n.id) }}>{n.id}</button>)}
      <button type="button" data-testid="badge:skill:grasp_can" onClick={() => { onToggle('skill:grasp_can') }}>+</button>
    </div>
  ),
}))

// The real canvas over a stub React Flow: `onInit` hands back a spy `fitView`
// and the node positions land in a data attribute.
const { fitView } = vi.hoisted(() => ({ fitView: vi.fn() }))
vi.mock('@xyflow/react', async () => {
  const { useEffect } = await vi.importActual<typeof import('react')>('react')
  return {
    Background: () => null, Controls: () => null, MiniMap: () => null, Handle: () => null,
    Position: { Left: 'left', Right: 'right' },
    useStore: (sel: (s: { transform: number[] }) => unknown) => sel({ transform: [0, 0, 0.6] }),
    ReactFlow: ({ nodes, onInit }: {
      nodes: Array<{ position: { x: number; y: number } }>
      onInit: (i: { fitView: typeof fitView }) => void
    }) => {
      useEffect(() => { onInit({ fitView }) }, [onInit])
      return <div data-testid="rf" data-pos={nodes.map(n => `${n.position.x},${n.position.y}`).join(' ')} />
    },
  }
})

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
    { kind: 'class', id: 'class:grasp', name: 'grasp', skills: 4 },
    { kind: 'class', id: 'class:nav', name: 'nav', skills: 1 },
    { kind: 'package', id: 'plugins/robocasa', name: 'robocasa', provides: ['cap.sim'], binds: { tasks: ['kitchen_thaw'], campaigns: [] }, bundles: ['sim'], actuation: 'sim', needs_sim: true, third_party: ['robocasa'], enabled: true },
    { kind: 'skill', id: 'skill:grasp_can', status: 'library', name: 'grasp_can', skill_kind: 'segment', class: 'grasp',
      description: 'Grasp the can', args: { target: 'obj' }, requires: ['near(target)'], ensures: ['held(target)'], clobbers: ['gripper'],
      limits: { max_steps: 300 }, failure_modes: ['reach_stall'],
      bindings: { robocasa: { pi05: { transport: 'zmq', ref: 'plugins.robocasa.pi05:make', checkpoint_sha: 'abcdef0123456789' }, scripted: { transport: 'inproc', ref: 'plugins.robocasa.grasp:make' } } },
      evidence: { robocasa: { n: 9, k: 5, by_executor: { pi05: { n: 2, k: 1 }, scripted: { n: 7, k: 4 } } } }, instances: 2 },
    { kind: 'skill', id: 'skill:grasp_can1', status: 'library', name: 'grasp_can1', skill_kind: 'segment', class: 'grasp', requires: ['near(target)'], ensures: ['held(target)'], bindings: { robocasa: { scripted: { transport: 'inproc', ref: 'x' } } }, evidence: { robocasa: { n: 2, k: 2 } } },
    { kind: 'skill', id: 'skill:grasp_can2', status: 'library', name: 'grasp_can2', skill_kind: 'segment', class: 'grasp', requires: [], ensures: [], bindings: { robocasa: { scripted: { transport: 'inproc', ref: 'x' } } }, evidence: {} },
    { kind: 'skill', id: 'skill:grasp_cup', status: 'library', name: 'grasp_cup', skill_kind: 'segment', class: 'grasp', requires: [], ensures: ['held(cup)'], bindings: { so101: { scripted: { transport: 'inproc', ref: 'x' } } }, evidence: {} },
    { kind: 'skill', id: 'skill:nav_fridge', status: 'library', name: 'nav_fridge', skill_kind: 'segment', class: 'nav', requires: [], ensures: ['near(target)'], bindings: { robocasa: { scripted: { transport: 'inproc', ref: 'y' } } }, evidence: { robocasa: { n: 3, k: 3 } } },
    { kind: 'skill', id: 'sha-legacy', status: 'promoted', task: 'stack', label: 'legacy stack' },
  ],
  edges: [
    { rel: 'BOUND_TO', src: 'skill:grasp_can', dst: 'plugins/robocasa', rule: 'bindings ref module -> card dir', via: 'r' },
    { rel: 'DEPENDS_ON', src: 'skill:grasp_can', dst: 'skill:nav_fridge', rule: 'requires∩ensures', via: 'skill-library/records/grasp_can.json' },
    { rel: 'DEPENDS_ON', src: 'skill:grasp_can1', dst: 'skill:nav_fridge', rule: 'requires∩ensures', via: 'skill-library/records/grasp_can1.json' },
    { rel: 'EVIDENCED_ON', src: 'skill:grasp_can1', dst: 'benchmark:kitchen', rule: 'harness.protocol.skill_benchmarks', via: 'r', n: 2, k: 2 },
    { rel: 'INSTANCE_OF', src: 'skill:grasp_can1', dst: 'skill:grasp_can', rule: 'name prefix within class', via: 'r' },
    { rel: 'INSTANCE_OF', src: 'skill:grasp_can2', dst: 'skill:grasp_can', rule: 'name prefix within class', via: 'r' },
    { rel: 'EVIDENCED_ON', src: 'skill:grasp_can', dst: 'benchmark:kitchen', rule: 'harness.protocol.skill_benchmarks', via: 'r', n: 9, k: 5 },
    { rel: 'EVIDENCED_ON', src: 'skill:nav_fridge', dst: 'benchmark:kitchen', rule: 'harness.protocol.skill_benchmarks', via: 'r', n: 3, k: 3 },
    { rel: 'IN_CLASS', src: 'skill:grasp_can', dst: 'class:grasp', rule: 'declared class', via: 'r' },
    { rel: 'IN_CLASS', src: 'skill:grasp_can1', dst: 'class:grasp', rule: 'declared class', via: 'r' },
    { rel: 'IN_CLASS', src: 'skill:grasp_can2', dst: 'class:grasp', rule: 'declared class', via: 'r' },
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

  it('groups library skills under their class, nests instances under their generic, and parks legacy nodes in one trailing section', () => {
    const tree = classTree(idx, { benchmark: '', embodiment: '', search: '' })
    // `skills` keeps every member (the count); `roots` nests instances under the generic.
    expect(tree.classes.map(c => [c.node.id, c.skills.map(s => s.name)])).toEqual([
      ['class:grasp', ['grasp_can', 'grasp_can1', 'grasp_can2', 'grasp_cup']], ['class:nav', ['nav_fridge']],
    ])
    expect(tree.classes[0]!.roots.map(r => [r.node.name, r.instances.map(i => i.name)])).toEqual([
      ['grasp_can', ['grasp_can1', 'grasp_can2']], ['grasp_cup', []],
    ])
    expect(tree.legacy.map(n => n.id)).toEqual(['sha-legacy', 'plugins/robocasa', 'cap.sim'])
  })

  it('narrows by benchmark (EVIDENCED_ON) and by embodiment (bindings key)', () => {
    const byBench = classTree(idx, { benchmark: 'benchmark:kitchen', embodiment: '', search: '' })
    expect(byBench.classes.map(c => c.skills.map(s => s.name))).toEqual([['grasp_can', 'grasp_can1'], ['nav_fridge']])
    const byEmb = classTree(idx, { benchmark: '', embodiment: 'so101', search: '' })
    expect(byEmb.classes.map(c => [c.node.id, c.skills.map(s => s.name)])).toEqual([['class:grasp', ['grasp_cup']]])
  })

  it('no selection → the class overview: class nodes, touched benchmark/package nodes, aggregated counted edges, no skills', () => {
    const ov = overview(GRAPH, idx)
    expect(ov.nodes.map(n => n.id)).toEqual(['benchmark:kitchen', 'class:grasp', 'class:nav', 'plugins/robocasa'])
    expect(ov.edges.map(e => [e.rel, e.src, e.dst, e.count])).toEqual([
      ['BOUND_TO', 'class:grasp', 'plugins/robocasa', 1],
      ['DEPENDS_ON', 'class:grasp', 'class:nav', 2],
      ['EVIDENCED_ON', 'class:grasp', 'benchmark:kitchen', 2],
      ['EVIDENCED_ON', 'class:nav', 'benchmark:kitchen', 1],
    ])
    expect(neighborhood(GRAPH, idx, null)).toEqual(ov)
    // The aggregated count rides the painted edge label.
    const lay = layout(ov, NO_FILTER)
    expect(lay.edges.map(e => e.label)).toContain('DEPENDS_ON ×2')
    expect(lay.nodes.map(n => n.type)).not.toContain('skill')
  })

  it('draws a class with its generic skills and their typed neighbors; instances unfold only when expanded', () => {
    const cls = neighborhood(GRAPH, idx, 'class:grasp')
    expect(cls.nodes.map(n => n.id)).toEqual([
      'benchmark:kitchen', 'class:grasp', 'plugins/robocasa', 'skill:grasp_can', 'skill:grasp_cup', 'skill:nav_fridge',
    ])
    expect(cls.edges.every(e => cls.nodes.some(n => n.id === e.src) && cls.nodes.some(n => n.id === e.dst))).toBe(true)
    const open = neighborhood(GRAPH, idx, 'class:grasp', { expanded: new Set(['skill:grasp_can']), deep: false })
    expect(open.nodes.map(n => n.id)).toContain('skill:grasp_can1')
    expect(open.nodes.map(n => n.id)).toContain('skill:grasp_can2')
    expect(open.edges.filter(e => e.rel === 'INSTANCE_OF')).toHaveLength(2)
  })

  it('draws a library skill at depth 1, depth 2 with the deeper toggle, never a class\'s members through IN_CLASS', () => {
    const nav = neighborhood(GRAPH, idx, 'skill:nav_fridge')
    // depth 1 only: grasp_can + grasp_can1 (depend on it), kitchen, class:nav — not grasp_can's card or class.
    expect(nav.nodes.map(n => n.id)).toEqual(['benchmark:kitchen', 'class:nav', 'skill:grasp_can', 'skill:grasp_can1', 'skill:nav_fridge'])
    const deep = neighborhood(GRAPH, idx, 'skill:nav_fridge', { expanded: new Set(), deep: true })
    expect(deep.nodes.map(n => n.id)).toContain('plugins/robocasa')
    expect(deep.nodes.map(n => n.id)).toContain('class:grasp')
    // grasp_cup is a class:grasp member reachable only via IN_CLASS in-edge; grasp_can2 only via a collapsed INSTANCE_OF.
    expect(deep.nodes.map(n => n.id)).not.toContain('skill:grasp_cup')
    expect(deep.nodes.map(n => n.id)).not.toContain('skill:grasp_can2')
  })

  it('lays every selection out on distinct positions across more than one rank (no stacked column)', () => {
    for (const sel of [null, 'class:grasp', 'skill:nav_fridge', 'skill:grasp_can']) {
      const lay = layout(neighborhood(GRAPH, idx, sel, { expanded: new Set(['skill:grasp_can']), deep: false }), NO_FILTER)
      const spots = new Set(lay.nodes.map(n => `${n.position.x},${n.position.y}`))
      expect(spots.size, `${sel}`).toBe(lay.nodes.length)
      expect(new Set(lay.nodes.map(n => n.position.x)).size, `${sel}`).toBeGreaterThan(1)
    }
  })
})

const NO_FILTER: VaultFilters = { kinds: new Set(), rels: new Set(), statuses: new Set(), search: '' }

describe('VaultGraphCanvas', () => {
  it('refits the viewport on every graph change and sizes a class node by its skill count', async () => {
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
    const { VaultGraphCanvas } = await vi.importActual<typeof import('../src/client/VaultGraphCanvas.tsx')>('../src/client/VaultGraphCanvas.tsx')
    const idx = indexGraph(GRAPH)
    const props = { filters: NO_FILTER, onSelect: vi.fn(), t }
    const { rerender } = render(<VaultGraphCanvas graph={neighborhood(GRAPH, idx, null)} selected={null} {...(props as unknown as Pick<Parameters<typeof VaultGraphCanvas>[0], 'filters' | 'onSelect' | 't'>)} />)
    await waitFor(() => { expect(fitView).toHaveBeenCalled() })
    const before = fitView.mock.calls.length
    const pos0 = screen.getByTestId('rf').getAttribute('data-pos')
    rerender(<VaultGraphCanvas graph={neighborhood(GRAPH, idx, 'class:grasp')} selected="class:grasp" {...(props as unknown as Pick<Parameters<typeof VaultGraphCanvas>[0], 'filters' | 'onSelect' | 't'>)} />)
    await waitFor(() => { expect(fitView.mock.calls.length).toBeGreaterThan(before) })
    expect(screen.getByTestId('rf').getAttribute('data-pos')).not.toBe(pos0)
  })
})

describe('VaultView', () => {
  it('renders the class tree with counts, expands a class to its skills with k/n, and filters by benchmark', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('grasp')).toBeTruthy() })
    expect(screen.getByText('· 4')).toBeTruthy()
    expect(screen.getByText('· 1')).toBeTruthy()
    expect(screen.getByText(en['tree.legacy'])).toBeTruthy()
    expect(screen.queryByText('grasp_can')).toBeNull()
    // No selection: the canvas draws the class overview (no skill nodes, counted edges).
    const canvas = screen.getByTestId('canvas')
    expect(canvas.getAttribute('data-nodes')).toBe('benchmark:kitchen class:grasp class:nav plugins/robocasa')
    expect(canvas.getAttribute('data-edges')).toContain('DEPENDS_ON:class:grasp>class:nav=2')
    fireEvent.click(screen.getByRole('button', { name: `grasp: ${en['pane.expand']}` }))
    expect(screen.getByText('grasp_can')).toBeTruthy()
    expect(screen.getByText('5/9')).toBeTruthy()
    expect(screen.getByText('grasp_cup')).toBeTruthy()
    // Instances nest under their generic behind a +n toggle.
    expect(screen.queryByText('grasp_can1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: `grasp_can: ${en['pane.expand']}` }))
    expect(screen.getByText('grasp_can1')).toBeTruthy()
    expect(screen.getByText('grasp_can2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: `grasp_can: ${en['pane.collapse']}` }))
    expect(screen.queryByText('grasp_can1')).toBeNull()
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
    // The deeper toggle shows for a library skill only and widens its neighborhood.
    expect(screen.queryByLabelText(en['graph.deeper'])).toBeNull()
    fireEvent.click(screen.getByTestId('gn:skill:nav_fridge'))
    expect(screen.getByTestId('canvas').getAttribute('data-nodes')).not.toContain('plugins/robocasa')
    fireEvent.click(screen.getByLabelText(en['graph.deeper']))
    expect(screen.getByTestId('canvas').getAttribute('data-nodes')).toContain('plugins/robocasa')
  })

  it('selecting a class draws its generics with instances collapsed; the canvas badge expands them (tree follows)', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('grasp')).toBeTruthy() })
    fireEvent.click(screen.getByText('grasp'))
    const nodes = () => screen.getByTestId('canvas').getAttribute('data-nodes') ?? ''
    expect(nodes()).toContain('skill:grasp_can')
    expect(nodes()).not.toContain('skill:grasp_can1')
    fireEvent.click(screen.getByTestId('badge:skill:grasp_can'))
    expect(nodes()).toContain('skill:grasp_can1')
    expect(nodes()).toContain('skill:grasp_can2')
    // Tree row + class-page list row.
    expect(screen.getAllByText('grasp_can2')).toHaveLength(2)
    fireEvent.click(screen.getByTestId('badge:skill:grasp_can'))
    expect(screen.getAllByText('grasp_can2')).toHaveLength(1)
    // Selecting an instance (from the class page) opens its generic in the tree too.
    fireEvent.click(screen.getByText('grasp_can1'))
    expect(screen.getByRole('heading', { name: 'grasp_can1' })).toBeTruthy()
    expect(screen.getAllByText('grasp_can2')).toHaveLength(1)
    expect(screen.getByRole('button', { name: `grasp_can: ${en['pane.collapse']}` })).toBeTruthy()
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
