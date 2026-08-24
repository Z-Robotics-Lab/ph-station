/**
 * Pure fold: the board vault payload → the wiki graph's view model plus its
 * dagre layout. Rendering-state assembly only — every number, status, and
 * relation is copied verbatim from board/vault.py (the deterministic fold);
 * nothing is computed here (charter: TS renders only).
 *
 * The vault is a typed, backlinked graph over three node kinds (skill /
 * package / capability) and a fixed nine-relation edge vocabulary. This module
 * mirrors board/vault.py's output as TypeScript, filters it by the operator's
 * kind/status/relation chips, and lays the survivors out left-to-right through
 * dagre so lineage (DESCENDS_FROM) reads as a chain.
 */

import dagre from '@dagrejs/dagre'

/** The fixed relation vocabulary (board/vault.py §2.5); edges carry one each. */
export type VaultRel =
  | 'DESCENDS_FROM' | 'GOVERNS' | 'REQUIRES' | 'PROVIDES' | 'BINDS'
  | 'EVIDENCED_BY' | 'CLAIMS' | 'SUPERSEDES' | 'MOUNTED_IN'

/** The three node kinds the fold emits. */
export type VaultKind = 'skill' | 'package' | 'capability'

/** Derived skill status (board/vault.py §2.6); drives the node color. */
export type SkillStatus = 'promoted' | 'candidate' | 'retired'

/** One held-out / dev evidence block, verbatim from bundle_evidence/effects. */
export interface EvidenceBlock {
  readonly governed_rate?: number
  readonly base_rate?: number
  readonly fixed?: number
  readonly n?: number
  readonly p_value?: number
  readonly broken?: number
}

/** One ablation ladder rung: [noise, {fixed, governed_rate, declared_privilege}]. */
export type AblationRung = [number, { fixed?: number; governed_rate?: number; declared_privilege?: number }]

/** A skill node body (a promoted/candidate/retired SkillRecord). */
export interface SkillNode {
  readonly kind: 'skill'
  readonly id: string
  readonly task?: string
  readonly skill_kind?: string
  readonly generation?: number
  readonly policy?: string
  readonly label?: string
  readonly trigger?: Record<string, unknown>
  readonly recovery?: { name?: string; strategy?: string; steps?: number; max_invocations?: number }
  readonly privilege?: number
  readonly evidence?: {
    heldout?: EvidenceBlock
    judgement?: EvidenceBlock
    judgement_dev?: EvidenceBlock
    dev_gate?: EvidenceBlock
    ablation?: AblationRung[]
    heldout_delta?: number
  }
  readonly heldout_judgement_established?: boolean
  readonly status: SkillStatus
  readonly anchors?: Record<string, string | null>
  readonly evidenced_by?: string | null
  readonly annotations?: VaultAnnotation | null
}

/** A package node body (one manifest card). */
export interface PackageNode {
  readonly kind: 'package'
  readonly id: string
  readonly name?: string
  readonly provides?: string[]
  readonly binds?: { tasks?: string[]; campaigns?: string[] }
  readonly bundles?: string[]
  readonly actuation?: string | null
  readonly needs_sim?: boolean | null
  readonly third_party?: string[]
  readonly enabled?: boolean
  readonly claim?: Record<string, unknown> | null
  readonly claim_sealed?: { store?: string; skills?: string[]; heldout_judgement_established?: boolean } | null
  readonly annotations?: VaultAnnotation | null
}

/** A capability node body (one seam in the fixed catalog). */
export interface CapabilityNode {
  readonly kind: 'capability'
  readonly id: string
  readonly contract?: string
  readonly privileged?: boolean
  readonly doc?: string
  readonly annotations?: VaultAnnotation | null
}

/** An additive annotation sidecar (never overwrites a derived field). */
export interface VaultAnnotation {
  readonly note?: string
  readonly tags?: string[]
  readonly see_also?: string[]
}

/** Any vault node. */
export type VaultNode = SkillNode | PackageNode | CapabilityNode

/** One directed, typed edge with its mechanical derivation `rule` and `via`. */
export interface VaultEdge {
  readonly rel: VaultRel
  readonly src: string
  readonly dst: string
  readonly rule: string
  readonly via: string
}

/** The whole fold output (board/vault.py build_graph). */
export interface VaultGraph {
  readonly schema_version: number
  readonly generated_from?: unknown
  readonly nodes: VaultNode[]
  readonly edges: VaultEdge[]
}

/** The operator's live filter selection; an empty set for a facet means "all". */
export interface VaultFilters {
  readonly kinds: ReadonlySet<VaultKind>
  readonly rels: ReadonlySet<VaultRel>
  readonly statuses: ReadonlySet<SkillStatus>
  readonly search: string
}

/** Every relation, in reading order (the chip row + edge legend). */
export const ALL_RELS: readonly VaultRel[] = [
  'DESCENDS_FROM', 'GOVERNS', 'REQUIRES', 'PROVIDES', 'BINDS',
  'EVIDENCED_BY', 'CLAIMS', 'SUPERSEDES', 'MOUNTED_IN',
]

/** The three kinds, in reading order. */
export const ALL_KINDS: readonly VaultKind[] = ['skill', 'package', 'capability']

/** The three derived skill statuses, in reading order. */
export const ALL_STATUSES: readonly SkillStatus[] = ['promoted', 'candidate', 'retired']

/** Whether a node passes the current kind/status/search filters. */
export function nodeVisible(node: VaultNode, f: VaultFilters): boolean {
  if (f.kinds.size > 0 && !f.kinds.has(node.kind)) return false
  if (node.kind === 'skill' && f.statuses.size > 0 && !f.statuses.has(node.status)) return false
  if (f.search.trim() !== '') {
    const q = f.search.trim().toLowerCase()
    const hay = [node.id, (node as SkillNode).task, (node as SkillNode).label, (node as PackageNode).name]
      .filter((s): s is string => typeof s === 'string').join(' ').toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

/** A positioned React Flow node carrying its vault body for the custom renderer. */
export interface LaidOutNode {
  id: string
  type: VaultKind
  position: { x: number; y: number }
  data: { node: VaultNode; dimmed: boolean }
}

/** A React Flow edge with its relation label. */
export interface LaidOutEdge {
  id: string
  source: string
  target: string
  rel: VaultRel
  label: string
}

/** Fixed node footprints for the deterministic dagre pass (React Flow measures
 * after mount, but the layout wants stable inputs). */
export const NODE_SIZE: Record<VaultKind, { width: number; height: number }> = {
  skill: { width: 210, height: 74 },
  package: { width: 190, height: 58 },
  capability: { width: 180, height: 52 },
}

/**
 * Fold the graph into a dagre left-to-right layout over the FILTERED subset.
 * An edge survives only when both endpoints do and its relation is selected;
 * a node dimmed by search still lays out (context) but renders muted.
 * @param graph - the board vault payload.
 * @param f - the live filter selection.
 * @returns positioned nodes + labeled edges for React Flow.
 */
export function layout(graph: VaultGraph, f: VaultFilters): { nodes: LaidOutNode[]; edges: LaidOutEdge[] } {
  // Kind/status gate first (search only dims, so a searched node keeps its
  // neighborhood on screen). Then keep edges whose both ends survive.
  const kindPass = new Map(graph.nodes
    .filter(n => (f.kinds.size === 0 || f.kinds.has(n.kind))
      && !(n.kind === 'skill' && f.statuses.size > 0 && !f.statuses.has(n.status)))
    .map(n => [n.id, n]))
  const relOk = (rel: VaultRel): boolean => f.rels.size === 0 || f.rels.has(rel)
  const edges = graph.edges.filter(e => relOk(e.rel) && kindPass.has(e.src) && kindPass.has(e.dst))

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 22, ranksep: 90, marginx: 12, marginy: 12 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const [id, node] of kindPass) g.setNode(id, { ...NODE_SIZE[node.kind] })
  for (const e of edges) g.setEdge(e.src, e.dst)
  dagre.layout(g)

  const q = f.search.trim().toLowerCase()
  const nodes: LaidOutNode[] = [...kindPass.values()].map((node) => {
    const pos = g.node(node.id)
    return {
      id: node.id,
      type: node.kind,
      position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
      data: { node, dimmed: q !== '' && !nodeVisible(node, f) },
    }
  })
  const laidEdges: LaidOutEdge[] = edges.map(e => ({
    id: `${e.rel}:${e.src}->${e.dst}`,
    source: e.src, target: e.dst, rel: e.rel, label: e.rel,
  }))
  return { nodes, edges: laidEdges }
}

/** In-edges (backlinks) of one node. */
export function backlinks(graph: VaultGraph, id: string): VaultEdge[] {
  return graph.edges.filter(e => e.dst === id)
}

/** Out-edges of one node. */
export function outEdges(graph: VaultGraph, id: string): VaultEdge[] {
  return graph.edges.filter(e => e.src === id)
}

/** Index nodes by id for O(1) page lookup. */
export function indexNodes(graph: VaultGraph): Map<string, VaultNode> {
  return new Map(graph.nodes.map(n => [n.id, n]))
}
