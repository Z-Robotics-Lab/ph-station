/**
 * The grouped vault layout (graph.ts §5.2): one titled region per kind, skill
 * nodes sub-clustered by task family, every leaf inside its cluster box, and
 * all edges preserved so the nine relations stay drawable across regions.
 */

import { describe, expect, it } from 'vitest'
import { layout, relTallies, renderableRels } from '../src/client/graph.ts'
import type { VaultFilters, VaultGraph } from '../src/client/graph.ts'

const NO_FILTER: VaultFilters = { kinds: new Set(), rels: new Set(), statuses: new Set(), search: '' }

/** A small fold with three skill tasks, two packages, two capabilities, and
 * cross-region edges spanning several relations. */
const GRAPH: VaultGraph = {
  schema_version: 1,
  nodes: [
    { kind: 'skill', id: 's1', task: 'stack', status: 'promoted' },
    { kind: 'skill', id: 's2', task: 'stack', status: 'candidate' },
    { kind: 'skill', id: 's3', task: 'lift_geometric', status: 'promoted' },
    { kind: 'skill', id: 's4', task: 'clear_table', status: 'retired' },
    { kind: 'package', id: 'pkg.a', name: 'A' },
    { kind: 'package', id: 'pkg.b', name: 'B' },
    { kind: 'capability', id: 'cap.x', privileged: false },
    { kind: 'capability', id: 'cap.y', privileged: true },
  ],
  edges: [
    { rel: 'DESCENDS_FROM', src: 's2', dst: 's1', rule: 'r', via: 'v' },
    { rel: 'REQUIRES', src: 's1', dst: 'cap.x', rule: 'r', via: 'v' },
    { rel: 'REQUIRES', src: 's3', dst: 'cap.y', rule: 'r', via: 'v' },
    { rel: 'PROVIDES', src: 'pkg.a', dst: 'cap.x', rule: 'r', via: 'v' },
    { rel: 'MOUNTED_IN', src: 's1', dst: 'pkg.a', rule: 'r', via: 'v' },
  ],
}

describe('grouped vault layout', () => {
  const out = layout(GRAPH, NO_FILTER)
  const bands = out.containers.filter(c => c.variant === 'band')
  const tasks = out.containers.filter(c => c.variant === 'task')

  it('emits exactly one band container per present kind', () => {
    expect(bands.map(b => b.id).sort()).toEqual(['band:capability', 'band:package', 'band:skill'])
  })

  it('emits one skill task sub-container per distinct task', () => {
    const distinct = new Set(GRAPH.nodes.filter(n => n.kind === 'skill').map(n => (n as { task?: string }).task))
    expect(tasks).toHaveLength(distinct.size)
    expect(tasks.every(t => t.kind === 'skill')).toBe(true)
  })

  it('places every skill leaf inside one task sub-container', () => {
    const skillNodes = out.nodes.filter(n => n.type === 'skill')
    expect(skillNodes).toHaveLength(4)
    for (const n of skillNodes) {
      const inside = tasks.some(c =>
        n.position.x >= c.position.x && n.position.x < c.position.x + c.width
        && n.position.y >= c.position.y && n.position.y < c.position.y + c.height)
      expect(inside, `node ${n.id} inside a task box`).toBe(true)
    }
  })

  it('aligns the region lanes to one width', () => {
    expect(new Set(bands.map(b => b.width)).size).toBe(1)
  })

  it('preserves every edge (all nine relations stay drawable)', () => {
    expect(out.edges).toHaveLength(GRAPH.edges.length)
    expect(out.edges.map(e => e.rel)).toEqual(GRAPH.edges.map(e => e.rel))
  })

  it('drops a region when its kind is filtered out', () => {
    const skillOnly = layout(GRAPH, { ...NO_FILTER, kinds: new Set(['skill']) })
    expect(skillOnly.containers.filter(c => c.variant === 'band').map(b => b.id)).toEqual(['band:skill'])
  })

  it('seats the capability lane above the package lane (middle lane)', () => {
    const cap = bands.find(b => b.id === 'band:capability')
    const pkg = bands.find(b => b.id === 'band:package')
    expect(cap && pkg && cap.position.y < pkg.position.y).toBe(true)
  })
})

describe('relation tallies', () => {
  /** A fold whose GOVERNS edge targets a task id that is not a node, plus two
   * REQUIRES that land on a real capability. */
  const GRAPH: VaultGraph = {
    schema_version: 1,
    nodes: [
      { kind: 'skill', id: 's1', status: 'promoted' },
      { kind: 'capability', id: 'cap.x', privileged: false },
    ],
    edges: [
      { rel: 'REQUIRES', src: 's1', dst: 'cap.x', rule: 'r', via: 'v' },
      { rel: 'GOVERNS', src: 's1', dst: 'task:stack', rule: 'r', via: 'v' },
      { rel: 'GOVERNS', src: 's1', dst: 'task:lift', rule: 'r', via: 'v' },
    ],
  }

  it('counts rendered edges (both endpoints are nodes) vs total fold edges', () => {
    const t = relTallies(GRAPH)
    expect(t.REQUIRES).toEqual({ total: 1, rendered: 1 })
    expect(t.GOVERNS).toEqual({ total: 2, rendered: 0 })
  })

  it('reports only families that draw (GOVERNS-to-a-task is a dead control)', () => {
    expect([...renderableRels(GRAPH)]).toEqual(['REQUIRES'])
  })
})
