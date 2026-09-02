/**
 * The layered canvas layout (graph.ts `layered`) over the real `storecli vault`
 * dump: three fixed columns 能力 | 卡片 | 技能 (one swimlane per class), no two
 * nodes overlapping, relation chips gating edges, predicate nodes behind the
 * 前置/保证 chip, cards mode adding a card's BOUND_TO skills by hand, and the
 * 历史 chip gating the legacy records and relations.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { absolutePosition, COL_X, defaultToggles, HISTORY_RELS, indexGraph, layered } from '../src/client/graph.ts'
import type { LaidOutNode, LayerView, RelToggle, VaultGraph } from '../src/client/graph.ts'

const GRAPH = JSON.parse(readFileSync(new URL('./fixtures/vault.real.json', import.meta.url), 'utf8')) as VaultGraph
const idx = indexGraph(GRAPH)

const view = (over: Partial<LayerView> = {}): LayerView => ({
  mode: 'all', on: defaultToggles(GRAPH), openClasses: new Set(), expanded: new Set(), added: new Set(), search: '', ...over,
})
const without = (tg: RelToggle): Set<RelToggle> => { const s = defaultToggles(GRAPH); s.delete(tg); return s }
const withT = (tg: RelToggle): Set<RelToggle> => defaultToggles(GRAPH).add(tg)
const ids = (nodes: LaidOutNode[]) => nodes.map(n => n.id)

/** Absolute footprints overlap (share interior area); a lane and its own child never count. */
function overlapping(nodes: LaidOutNode[]): string[] {
  const box = nodes.map(n => ({ n, ...absolutePosition(nodes, n) }))
  const bad: string[] = []
  box.forEach((a, i) => box.slice(i + 1).forEach((b) => {
    if (a.n.parentId === b.n.id || b.n.parentId === a.n.id) return
    if (a.x < b.x + b.n.width && a.x + a.n.width > b.x && a.y < b.y + b.n.height && a.y + a.n.height > b.y) bad.push(`${a.n.id} × ${b.n.id}`)
  }))
  return bad
}

describe('layered layout: three fixed columns', () => {
  const out = layered(GRAPH, idx, view())

  it('stacks capabilities, cards, and class lanes at their column x; no skill nodes while every lane is collapsed', () => {
    const caps = out.nodes.filter(n => n.type === 'capability')
    const cards = out.nodes.filter(n => n.type === 'package' || n.type === 'benchmark')
    const lanes = out.nodes.filter(n => n.type === 'lane')
    expect(caps).toHaveLength(10)
    expect(cards).toHaveLength(28)
    expect(lanes).toHaveLength(10)
    expect(caps.every(n => n.position.x === COL_X.capability)).toBe(true)
    expect(cards.every(n => n.position.x === COL_X.package)).toBe(true)
    expect(lanes.every(n => n.position.x === COL_X.skill)).toBe(true)
    expect(out.nodes.filter(n => n.type === 'skill')).toHaveLength(0)
    expect(ids(out.nodes)).toEqual(expect.arrayContaining(['col:capability', 'col:package', 'col:skill', 'group:embodiment', 'group:mission']))
    // Lane label carries the class name and full member count.
    expect(out.nodes.find(n => n.id === 'class:carry')?.data).toMatchObject({ label: 'carry', open: false })
  })

  it('never overlaps two nodes (collapsed, one lane open, an instance expanded, history + predicates on)', () => {
    expect(overlapping(out.nodes)).toEqual([])
    const busy = layered(GRAPH, idx, view({ openClasses: new Set(['class:carry', 'class:grasp']), expanded: new Set(['skill:carry']), on: withT('CONTRACT').add('HISTORY') }))
    expect(overlapping(busy.nodes)).toEqual([])
    expect(busy.nodes.filter(n => n.type === 'skill').length).toBeGreaterThan(2)
  })

  it('folds collapsed lanes into counted class-level edges and draws only chip-admitted relations', () => {
    const deps = out.edges.filter(e => e.rel === 'DEPENDS_ON')
    expect(deps.length).toBeGreaterThan(0)
    expect(deps.every(e => e.source.startsWith('class:') && e.target.startsWith('class:'))).toBe(true)
    expect(deps.reduce((n, e) => n + e.count, 0)).toBe(151) // the cross-class DEPENDS_ON edges
    expect(out.edges.some(e => e.label.startsWith('DEPENDS_ON ×'))).toBe(true)
    expect(out.edges.filter(e => e.rel === 'PROVIDES')).toHaveLength(12)
    expect(out.edges.filter(e => e.rel === 'BOUND_TO')).toEqual([expect.objectContaining({ source: 'class:place', target: 'plugins/policy_vla_remote', count: 1 })])
    expect(out.edges.some(e => e.rel === 'IN_CLASS')).toBe(false)
    expect(out.edges.some(e => HISTORY_RELS.includes(e.rel as never))).toBe(false)
  })

  it('toggling 依赖 off removes the DEPENDS_ON edges and nothing else', () => {
    const off = layered(GRAPH, idx, view({ on: without('DEPENDS_ON') }))
    expect(off.edges.some(e => e.rel === 'DEPENDS_ON')).toBe(false)
    expect(off.edges.filter(e => e.rel !== 'DEPENDS_ON')).toEqual(out.edges.filter(e => e.rel !== 'DEPENDS_ON'))
    expect(ids(off.nodes)).toEqual(ids(out.nodes))
  })

  it('opening a lane draws its generics as children; an expanded generic nests its instances', () => {
    const open = layered(GRAPH, idx, view({ openClasses: new Set(['class:carry']) }))
    const carry = open.nodes.find(n => n.id === 'skill:carry')!
    expect(carry.parentId).toBe('class:carry')
    expect(ids(open.nodes)).not.toContain('skill:carry_can1')
    const more = layered(GRAPH, idx, view({ openClasses: new Set(['class:carry']), expanded: new Set(['skill:carry']) }))
    const inst = more.nodes.find(n => n.id === 'skill:carry_can1')!
    expect(inst.parentId).toBe('class:carry')
    expect(inst.position.x).toBeGreaterThan(carry.position.x)
    expect(more.edges.some(e => e.rel === 'INSTANCE_OF' && e.source === 'skill:carry_can1' && e.target === 'skill:carry')).toBe(true)
    // A member's DEPENDS_ON to a collapsed class folds to that lane.
    expect(open.edges.some(e => e.rel === 'DEPENDS_ON' && e.source === 'skill:carry' && e.target.startsWith('class:'))).toBe(true)
  })

  it('前置/保证 on adds predicate nodes in the fourth column wired requires→skill / skill→ensures', () => {
    const base = layered(GRAPH, idx, view({ openClasses: new Set(['class:carry']) }))
    expect(base.nodes.some(n => n.type === 'predicate')).toBe(false)
    const on = layered(GRAPH, idx, view({ openClasses: new Set(['class:carry']), on: withT('CONTRACT') }))
    const preds = on.nodes.filter(n => n.type === 'predicate')
    expect(preds.length).toBeGreaterThan(0)
    expect(preds.every(n => n.position.x === COL_X.predicate)).toBe(true)
    expect(ids(preds)).toContain('pred:holding(object)')
    expect(on.edges).toContainEqual(expect.objectContaining({ rel: 'requires', source: 'pred:holding(object)', target: 'skill:carry' }))
    expect(on.edges).toContainEqual(expect.objectContaining({ rel: 'ensures', source: 'skill:carry', target: 'pred:reachable(target)' }))
  })

  it('能力与卡片 mode hides the skills until a card\'s BOUND_TO skills are added', () => {
    const empty = layered(GRAPH, idx, view({ mode: 'cards' }))
    expect(empty.nodes.filter(n => n.type === 'lane' || n.type === 'skill')).toHaveLength(0)
    expect(empty.nodes.filter(n => n.type === 'capability')).toHaveLength(10)
    expect(empty.edges.filter(e => e.rel === 'PROVIDES')).toHaveLength(12)
    const bound = GRAPH.edges.filter(e => e.rel === 'BOUND_TO' && e.dst === 'plugins/policy_vla_remote').map(e => e.src)
    expect(bound).toEqual(['skill:place_meat'])
    const added = layered(GRAPH, idx, view({ mode: 'cards', added: new Set(bound) }))
    expect(ids(added.nodes.filter(n => n.type === 'lane'))).toEqual(['class:place'])
    expect(ids(added.nodes.filter(n => n.type === 'skill'))).toEqual(['skill:place_meat'])
    expect(added.edges).toContainEqual(expect.objectContaining({ rel: 'BOUND_TO', source: 'skill:place_meat', target: 'plugins/policy_vla_remote' }))
    // Dependencies on skills not added stay off the canvas.
    expect(added.edges.every(e => added.nodes.some(n => n.id === e.source) && added.nodes.some(n => n.id === e.target))).toBe(true)
  })

  it('技能 mode draws the skills column alone', () => {
    const skills = layered(GRAPH, idx, view({ mode: 'skills' }))
    expect(skills.nodes.filter(n => n.type === 'capability' || n.type === 'package' || n.type === 'benchmark')).toHaveLength(0)
    expect(skills.nodes.filter(n => n.type === 'lane')).toHaveLength(10)
    expect(skills.edges.some(e => e.rel === 'PROVIDES' || e.rel === 'BOUND_TO')).toBe(false)
  })

  it('历史 off hides the legacy records and relations; on adds one lane of them', () => {
    expect(out.nodes.some(n => n.type === 'skill')).toBe(false)
    expect(ids(out.nodes)).not.toContain('lane:history')
    const hist = layered(GRAPH, idx, view({ on: withT('HISTORY') }))
    const lane = hist.nodes.find(n => n.id === 'lane:history')!
    expect(lane.data).toMatchObject({ key: 'tree.history', count: 8 })
    expect(hist.nodes.filter(n => n.parentId === 'lane:history')).toHaveLength(8)
    expect(hist.edges.filter(e => e.rel === 'REQUIRES')).toHaveLength(8)
    expect(hist.edges.filter(e => e.rel === 'CLAIMS')).toHaveLength(3)
    expect(hist.edges.filter(e => e.rel === 'DESCENDS_FROM').length).toBeGreaterThan(0)
    expect(overlapping(hist.nodes)).toEqual([])
  })

  it('seeds the chips with 依赖 · 实例 · 绑定 · 提供 · 挂载 and leaves 证据 off when the fold draws none', () => {
    expect([...defaultToggles(GRAPH)].sort()).toEqual(['BOUND_TO', 'DEPENDS_ON', 'INSTANCE_OF', 'MOUNTED_IN', 'PROVIDES'])
  })
})
