/**
 * The page's indexing over a real `storecli vault` dump (99 library records,
 * 10 classes, 31 per-object instances): the class overview aggregates counted
 * edges and carries no skill nodes; instances nest under their generic in the
 * tree and stay collapsed on the canvas until the generic is expanded.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { classTree, indexGraph, neighborhood, overview } from '../src/client/graph.ts'
import type { VaultGraph } from '../src/client/graph.ts'

const GRAPH = JSON.parse(readFileSync(new URL('./fixtures/vault.real.json', import.meta.url), 'utf8')) as VaultGraph
const idx = indexGraph(GRAPH)
const NO_FILTER = { benchmark: '', embodiment: '', search: '' }

describe('real vault fold', () => {
  it('nests the 31 instances under their generics across 10 classes without changing the member count', () => {
    const tree = classTree(idx, NO_FILTER)
    expect(tree.classes).toHaveLength(10)
    expect(tree.classes.reduce((n, c) => n + c.skills.length, 0)).toBe(99)
    const roots = tree.classes.flatMap(c => c.roots)
    expect(roots.reduce((n, r) => n + r.instances.length, 0)).toBe(31)
    expect(roots.length + 31).toBe(99)
    const carry = roots.find(r => r.node.id === 'skill:carry')!
    expect(carry.instances.map(i => i.id)).toContain('skill:carry_can1')
  })

  it('class overview: class nodes only, every aggregated edge counted, DEPENDS_ON folded across many members', () => {
    const ov = overview(GRAPH, idx)
    expect(neighborhood(GRAPH, idx, null)).toEqual(ov)
    expect(ov.nodes.filter(n => n.kind === 'skill')).toHaveLength(0)
    expect(ov.nodes.filter(n => n.kind === 'class')).toHaveLength(10)
    const deps = ov.edges.filter(e => e.rel === 'DEPENDS_ON')
    expect(deps.length).toBeGreaterThan(0)
    expect(deps.every(e => (e.count ?? 0) >= 1)).toBe(true)
    expect(Math.max(...deps.map(e => e.count!))).toBeGreaterThan(1)
    // Every cross-class dependency is counted once; the 5 intra-class ones
    // (press→close, v_carry↔v_grasped, ...) fold to a self-loop and are skipped.
    const classOf = (id: string) => GRAPH.edges.find(e => e.rel === 'IN_CLASS' && e.src === id)?.dst
    const raw = GRAPH.edges.filter(e => e.rel === 'DEPENDS_ON')
    const cross = raw.filter(e => classOf(e.src) !== classOf(e.dst))
    expect([raw.length, cross.length]).toEqual([156, 151])
    expect(deps.reduce((n, e) => n + e.count!, 0)).toBe(cross.length)
  })

  it('a selected class shows generics; instances unfold only once the generic is expanded', () => {
    const ids = (g: VaultGraph) => g.nodes.map(n => n.id)
    const collapsed = neighborhood(GRAPH, idx, 'class:carry')
    expect(ids(collapsed)).toContain('skill:carry')
    expect(ids(collapsed)).not.toContain('skill:carry_can1')
    const open = neighborhood(GRAPH, idx, 'class:carry', { expanded: new Set(['skill:carry']), deep: false })
    expect(ids(open)).toContain('skill:carry_can1')
  })
})
