/**
 * The page's tree indexing over a real `storecli vault` dump (99 library
 * records, 10 classes, 31 per-object instances, 8 legacy sealed records):
 * instances nest under their generic; cards and capabilities sit in their own
 * section; the legacy records form the 历史记录 section.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { classTree, indexGraph } from '../src/client/graph.ts'
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

  it('parks the 27 cards + 10 capabilities in the cards section and the 8 sealed records in the history section', () => {
    const tree = classTree(idx, NO_FILTER)
    expect(tree.cards.map(n => n.kind)).toEqual([...Array<string>(27).fill('package'), ...Array<string>(10).fill('capability')])
    expect(tree.legacy).toHaveLength(8)
    expect(tree.legacy.every(n => n.status !== ('library' as string))).toBe(true)
  })
})
