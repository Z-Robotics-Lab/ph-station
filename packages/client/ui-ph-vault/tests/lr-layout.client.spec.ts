/**
 * The global left→right vault layout (graph.ts §5.2): one dagre LR pass over the
 * filtered nodes. Skill lineage (DESCENDS_FROM: child→parent) lays out as a
 * horizontal chain (child left of parent); the cross-kind families point at
 * capabilities, so capabilities settle to the right. Node positions are seeded
 * by every node-to-node edge regardless of the relation chips, so a family
 * toggle changes only which edges paint, never a node's place.
 */

import { describe, expect, it } from 'vitest'
import { layout, NODE_SIZE, relTallies, renderableRels } from '../src/client/graph.ts'
import type { LaidOutNode, VaultFilters, VaultGraph } from '../src/client/graph.ts'

const NO_FILTER: VaultFilters = { kinds: new Set(), rels: new Set(), statuses: new Set(), search: '' }

/** A small fold: a three-generation stack lineage, two packages, two
 * capabilities, cross-kind edges, and one GOVERNS edge whose target is a task id
 * (not a node) so it neither seeds the layout nor paints. */
const GRAPH: VaultGraph = {
  schema_version: 1,
  nodes: [
    { kind: 'skill', id: 's1', task: 'stack', status: 'promoted' },
    { kind: 'skill', id: 's2', task: 'stack', status: 'candidate' },
    { kind: 'skill', id: 's3', task: 'stack', status: 'candidate' },
    { kind: 'package', id: 'pkg.a', name: 'A' },
    { kind: 'package', id: 'pkg.b', name: 'B' },
    { kind: 'capability', id: 'cap.x', privileged: false },
    { kind: 'capability', id: 'cap.y', privileged: true },
  ],
  edges: [
    { rel: 'DESCENDS_FROM', src: 's2', dst: 's1', rule: 'r', via: 'v' },
    { rel: 'DESCENDS_FROM', src: 's3', dst: 's2', rule: 'r', via: 'v' },
    { rel: 'REQUIRES', src: 's1', dst: 'cap.x', rule: 'r', via: 'v' },
    { rel: 'REQUIRES', src: 's3', dst: 'cap.y', rule: 'r', via: 'v' },
    { rel: 'PROVIDES', src: 'pkg.a', dst: 'cap.x', rule: 'r', via: 'v' },
    { rel: 'CLAIMS', src: 'pkg.b', dst: 's1', rule: 'r', via: 'v' },
    { rel: 'GOVERNS', src: 's1', dst: 'task:stack', rule: 'r', via: 'v' },
  ],
}

/** The six node-to-node edges (every edge except the task-targeted GOVERNS). */
const NODE_EDGE_COUNT = 6

const byId = (nodes: LaidOutNode[]): Map<string, LaidOutNode> => new Map(nodes.map(n => [n.id, n]))

/** Whether two laid-out node footprints overlap (share any interior area). */
function overlaps(a: LaidOutNode, b: LaidOutNode): boolean {
  const ra = NODE_SIZE[a.type], rb = NODE_SIZE[b.type]
  return a.position.x < b.position.x + rb.width && a.position.x + ra.width > b.position.x
    && a.position.y < b.position.y + rb.height && a.position.y + ra.height > b.position.y
}

describe('global LR vault layout', () => {
  const out = layout(GRAPH, NO_FILTER)
  const pos = byId(out.nodes)

  it('positions every surviving node and carries no cluster containers', () => {
    expect(out.nodes).toHaveLength(GRAPH.nodes.length)
    expect(out).not.toHaveProperty('containers')
  })

  it('lays skill lineage left→right (a child sits left of its parent)', () => {
    expect(pos.get('s2')!.position.x).toBeLessThan(pos.get('s1')!.position.x)
    expect(pos.get('s3')!.position.x).toBeLessThan(pos.get('s2')!.position.x)
  })

  it('settles a required capability to the right of the requiring skill', () => {
    expect(pos.get('cap.x')!.position.x).toBeGreaterThan(pos.get('s1')!.position.x)
    expect(pos.get('cap.y')!.position.x).toBeGreaterThan(pos.get('s3')!.position.x)
  })

  it('never overlaps two nodes', () => {
    out.nodes.forEach((a, i) => {
      out.nodes.slice(i + 1).forEach((b) => {
        expect(overlaps(a, b), `${a.id} overlaps ${b.id}`).toBe(false)
      })
    })
  })

  it('paints only node-to-node edges (the task-targeted GOVERNS never draws)', () => {
    expect(out.edges).toHaveLength(NODE_EDGE_COUNT)
    expect(out.edges.some(e => e.rel === 'GOVERNS')).toBe(false)
  })
})

describe('relation chips vs layout stability', () => {
  const all = layout(GRAPH, NO_FILTER)
  const lineageOff = layout(GRAPH, {
    ...NO_FILTER, rels: new Set(['REQUIRES', 'PROVIDES', 'CLAIMS']),
  })

  it('keeps every node position fixed when a family is toggled off', () => {
    const a = byId(all.nodes), b = byId(lineageOff.nodes)
    for (const [id, n] of a) expect(b.get(id)!.position).toEqual(n.position)
  })

  it('drops the deselected family from the painted edges only', () => {
    expect(lineageOff.edges.some(e => e.rel === 'DESCENDS_FROM')).toBe(false)
    expect(lineageOff.edges.some(e => e.rel === 'REQUIRES')).toBe(true)
    expect(all.edges).toHaveLength(NODE_EDGE_COUNT)
  })
})

describe('kind filter', () => {
  it('keeps only the selected kind and the edges internal to it', () => {
    const skillOnly = layout(GRAPH, { ...NO_FILTER, kinds: new Set(['skill']) })
    expect(skillOnly.nodes.every(n => n.type === 'skill')).toBe(true)
    expect(skillOnly.nodes).toHaveLength(3)
    expect(skillOnly.edges.every(e => e.rel === 'DESCENDS_FROM')).toBe(true)
    expect(skillOnly.edges).toHaveLength(2)
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
