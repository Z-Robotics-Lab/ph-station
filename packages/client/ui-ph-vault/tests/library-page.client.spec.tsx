// @vitest-environment jsdom
/**
 * The 技能库 page over a fixture fold of the five-kind graph: the class tree
 * groups library skills (IN_CLASS) with kind mark + k/n; the benchmark filter
 * narrows to skills EVIDENCED_ON it; selecting a skill shows its contract,
 * bindings, evidence, and dependency links; a dependency link navigates; a
 * package detail shows the card's manifest fields; the canvas receives the
 * layered layout (class lanes collapsed until opened; instances collapsed
 * under their generic until expanded); the layer mode and relation chips
 * drive it. The React Flow canvas is stubbed for the page tests (jsdom has no
 * ResizeObserver); one test mounts the real canvas over a mocked
 * `@xyflow/react` to prove it refits on every layout change. The layout fold
 * itself is covered by layered-layout.client.spec.ts.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { classTree, defaultToggles, indexGraph, layered } from '../src/client/graph.ts'
import type { VaultGraph, VaultLayout } from '../src/client/graph.ts'
import { en } from '../src/client/locales.ts'

vi.mock('../src/client/VaultGraphCanvas.tsx', () => ({
  KindGlyph: () => null,
  VaultGraphCanvas: ({ flow, selected, onSelect, onToggle, onToggleClass }: {
    flow: VaultLayout
    selected: string | null
    onSelect: (id: string) => void
    onToggle: (id: string) => void
    onToggleClass: (id: string) => void
  }) => (
    <div data-testid="canvas" data-selected={selected ?? ''} data-nodes={flow.nodes.filter(n => n.type !== 'header').map(n => n.id).join(' ')} data-edges={flow.edges.map(e => `${e.rel}:${e.source}>${e.target}=${e.count}`).join(' ')}>
      {flow.nodes.filter(n => n.type !== 'header').map(n => <button key={n.id} type="button" data-testid={`gn:${n.id}`} onClick={() => { onSelect(n.id) }}>{n.id}</button>)}
      <button type="button" data-testid="badge:skill:grasp_can" onClick={() => { onToggle('skill:grasp_can') }}>+</button>
      <button type="button" data-testid="lane:class:grasp" onClick={() => { onToggleClass('class:grasp') }}>▾</button>
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

  it('groups library skills under their class, nests instances under their generic, and splits cards from the legacy records', () => {
    const tree = classTree(idx, { benchmark: '', embodiment: '', search: '' })
    // `skills` keeps every member (the count); `roots` nests instances under the generic.
    expect(tree.classes.map(c => [c.node.id, c.skills.map(s => s.name)])).toEqual([
      ['class:grasp', ['grasp_can', 'grasp_can1', 'grasp_can2', 'grasp_cup']], ['class:nav', ['nav_fridge']],
    ])
    expect(tree.classes[0]!.roots.map(r => [r.node.name, r.instances.map(i => i.name)])).toEqual([
      ['grasp_can', ['grasp_can1', 'grasp_can2']], ['grasp_cup', []],
    ])
    expect(tree.cards.map(n => n.id)).toEqual(['plugins/robocasa', 'cap.sim'])
    expect(tree.legacy.map(n => n.id)).toEqual(['sha-legacy'])
  })

  it('narrows by benchmark (EVIDENCED_ON) and by embodiment (bindings key)', () => {
    const byBench = classTree(idx, { benchmark: 'benchmark:kitchen', embodiment: '', search: '' })
    expect(byBench.classes.map(c => c.skills.map(s => s.name))).toEqual([['grasp_can', 'grasp_can1'], ['nav_fridge']])
    const byEmb = classTree(idx, { benchmark: '', embodiment: 'so101', search: '' })
    expect(byEmb.classes.map(c => [c.node.id, c.skills.map(s => s.name)])).toEqual([['class:grasp', ['grasp_cup']]])
  })

  it('lays the fixture out in columns: capabilities, cards (benchmark under 任务/基准), collapsed class lanes with counted edges', () => {
    const lay = layered(GRAPH, idx, { mode: 'all', on: defaultToggles(GRAPH), openClasses: new Set(), expanded: new Set(), added: new Set(), search: '' })
    expect(lay.nodes.filter(n => n.type !== 'header').map(n => n.id)).toEqual(['cap.sim', 'plugins/robocasa', 'benchmark:kitchen', 'benchmark:lab', 'class:grasp', 'class:nav'])
    expect(lay.edges.map(e => [e.rel, e.source, e.target, e.count])).toEqual([
      ['BOUND_TO', 'class:grasp', 'plugins/robocasa', 1],
      ['DEPENDS_ON', 'class:grasp', 'class:nav', 2],
      ['EVIDENCED_ON', 'class:grasp', 'benchmark:kitchen', 2],
      ['EVIDENCED_ON', 'class:nav', 'benchmark:kitchen', 1],
      ['PROVIDES', 'plugins/robocasa', 'cap.sim', 1],
    ])
    expect(lay.edges.map(e => e.label)).toContain('DEPENDS_ON ×2')
  })
})

describe('VaultGraphCanvas', () => {
  it('refits the viewport on every layout change', async () => {
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
    const { VaultGraphCanvas } = await vi.importActual<typeof import('../src/client/VaultGraphCanvas.tsx')>('../src/client/VaultGraphCanvas.tsx')
    const idx = indexGraph(GRAPH)
    const view = (open: string[]) => ({ mode: 'all' as const, on: defaultToggles(GRAPH), openClasses: new Set(open), expanded: new Set<string>(), added: new Set<string>(), search: '' })
    const props = { onSelect: vi.fn(), t }
    const { rerender } = render(<VaultGraphCanvas flow={layered(GRAPH, idx, view([]))} selected={null} {...(props as unknown as Pick<Parameters<typeof VaultGraphCanvas>[0], 'onSelect' | 't'>)} />)
    await waitFor(() => { expect(fitView).toHaveBeenCalled() })
    const before = fitView.mock.calls.length
    const pos0 = screen.getByTestId('rf').getAttribute('data-pos')
    rerender(<VaultGraphCanvas flow={layered(GRAPH, idx, view(['class:grasp']))} selected="class:grasp" {...(props as unknown as Pick<Parameters<typeof VaultGraphCanvas>[0], 'onSelect' | 't'>)} />)
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
    // Nothing open: the canvas draws the three columns with every class lane collapsed (counted edges).
    const canvas = screen.getByTestId('canvas')
    expect(canvas.getAttribute('data-nodes')).toBe('cap.sim plugins/robocasa benchmark:kitchen benchmark:lab class:grasp class:nav')
    expect(canvas.getAttribute('data-edges')).toContain('DEPENDS_ON:class:grasp>class:nav=2')
    // The 历史 chip is off: the legacy record is neither in the tree nor on the canvas.
    expect(screen.queryByText(en['tree.history'])).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: `grasp: ${en['pane.expand']}` }))
    expect(screen.getByText('grasp_can')).toBeTruthy()
    // Opening the class in the tree opens its lane on the canvas (one shared state).
    expect(canvas.getAttribute('data-nodes')).toContain('skill:grasp_can')
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
    // The canvas marks the selection; its dependency (and its collapsed instance's) folds to the collapsed nav lane.
    const canvas = screen.getByTestId('canvas')
    expect(canvas.getAttribute('data-selected')).toBe('skill:grasp_can')
    expect(canvas.getAttribute('data-edges')).toContain('DEPENDS_ON:skill:grasp_can>class:nav=2')
    // Following the dependency selects nav_fridge: detail, tree (its class opens), and canvas follow.
    fireEvent.click(dep)
    expect(screen.getByRole('heading', { name: 'nav_fridge' })).toBeTruthy()
    expect(screen.getByText(en['dep.in'])).toBeTruthy()
    expect(screen.getByTestId('canvas').getAttribute('data-selected')).toBe('skill:nav_fridge')
    expect(screen.getByTestId('canvas').getAttribute('data-nodes')).toContain('skill:nav_fridge')
    expect(screen.getAllByText('nav_fridge').length).toBeGreaterThanOrEqual(2)
    // A canvas click selects too (bidirectional).
    fireEvent.click(screen.getByTestId('gn:class:nav'))
    expect(screen.getByRole('heading', { name: 'nav' })).toBeTruthy()
    expect(screen.getByText(en['class.benchmarks'])).toBeTruthy()
    // The lane chevron folds the class on the canvas and in the tree.
    fireEvent.click(screen.getByTestId('lane:class:grasp'))
    expect(screen.getByTestId('canvas').getAttribute('data-nodes')).not.toContain('skill:grasp_can')
    expect(screen.queryByText('grasp_can')).toBeNull()
  })

  it('relation chips gate edges; the layer mode swaps columns; cards mode adds a card\'s bound skills by hand', async () => {
    mount()
    await waitFor(() => { expect(screen.getByText('grasp')).toBeTruthy() })
    const edges = () => screen.getByTestId('canvas').getAttribute('data-edges') ?? ''
    const nodes = () => screen.getByTestId('canvas').getAttribute('data-nodes') ?? ''
    expect(edges()).toContain('DEPENDS_ON:')
    fireEvent.click(screen.getByLabelText(en['tog.DEPENDS_ON']))
    expect(edges()).not.toContain('DEPENDS_ON:')
    // 前置/保证 draws predicate nodes for the open lane's skills.
    fireEvent.click(screen.getByText('grasp'))
    fireEvent.click(screen.getByLabelText(en['tog.CONTRACT']))
    expect(nodes()).toContain('pred:near(target)')
    expect(edges()).toContain('requires:pred:near(target)>skill:grasp_can=1')
    // 历史 shows the legacy record (tree section + canvas lane + its REQUIRES edge).
    fireEvent.click(screen.getByLabelText(en['tog.HISTORY']))
    expect(screen.getByText(en['tree.history'])).toBeTruthy()
    expect(nodes()).toContain('sha-legacy')
    expect(edges()).toContain('REQUIRES:sha-legacy>cap.sim=1')
    // 技能 mode: no capability / card column.
    fireEvent.click(screen.getByRole('button', { name: en['mode.skills'] }))
    expect(nodes()).not.toContain('cap.sim')
    // 能力与卡片 mode: no skills until added; the selected card's 添加技能 adds its BOUND_TO skills.
    fireEvent.click(screen.getByRole('button', { name: en['mode.cards'] }))
    expect(nodes()).toContain('cap.sim')
    expect(nodes()).not.toContain('skill:grasp_can')
    expect(screen.queryByText(`${en['add.bound']} · 1`)).toBeNull()
    fireEvent.click(screen.getByTestId('gn:plugins/robocasa'))
    fireEvent.click(screen.getByText(`${en['add.bound']} · 1`))
    expect(nodes()).toContain('class:grasp')
    expect(nodes()).toContain('skill:grasp_can')
    expect(nodes()).not.toContain('skill:grasp_cup')
    expect(edges()).toContain('BOUND_TO:skill:grasp_can>plugins/robocasa=1')
    fireEvent.click(screen.getByText(en['add.all']))
    expect(nodes()).toContain('skill:grasp_cup')
    expect(nodes()).toContain('class:nav')
    fireEvent.click(screen.getByText(en['add.clear']))
    expect(nodes()).not.toContain('skill:grasp_can')
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
    // Bound skills are links on the card page; the capability page lists its providers.
    expect(screen.getByText(en['pkg.boundSkills'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'grasp_can' }))
    expect(screen.getByRole('heading', { name: 'grasp_can' })).toBeTruthy()
    fireEvent.click(screen.getByTestId('gn:cap.sim'))
    expect(screen.getByText(en['cap.providedBy'])).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'robocasa' }).length).toBeGreaterThanOrEqual(2) // tree row + provider link
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
