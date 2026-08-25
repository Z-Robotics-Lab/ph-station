/**
 * Pure fold: the board vault payload → the wiki graph's view model plus its
 * dagre layout. Rendering-state assembly only — every number, status, and
 * relation is copied verbatim from board/vault.py (the deterministic fold);
 * nothing is computed here (charter: TS renders only).
 *
 * The vault is a typed, backlinked graph over three node kinds (skill /
 * package / capability) and a fixed nine-relation edge vocabulary. This module
 * mirrors board/vault.py's output as TypeScript, filters it by the operator's
 * kind/status/search selection, and lays the survivors out through one global
 * dagre left-to-right pass so skill lineage (DESCENDS_FROM) reads as a
 * horizontal chain and the kinds fall into left→right ranks by edge direction
 * (packages and skills feed capabilities, so capabilities settle to the right).
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

/** The two highest-volume cross-band families (seven edges each in the live
 * fold), both terminating on the capability band. Hidden by default so the
 * graph opens legible; the operator opts them back in per relation chip. */
export const DENSE_RELS: readonly VaultRel[] = ['REQUIRES', 'PROVIDES']

/** Per-relation edge tally over the whole fold. `total` counts every fold edge
 * of the family; `rendered` counts only those whose both endpoints are node
 * kinds and can therefore draw. */
export interface RelTally { readonly total: number; readonly rendered: number }

/** Tally every relation family's fold edges against how many can render (both
 * endpoints are nodes). Families whose targets are tasks/campaigns/evidence
 * (GOVERNS/BINDS/EVIDENCED_BY/MOUNTED_IN) tally `rendered: 0`. */
export function relTallies(graph: VaultGraph): Record<VaultRel, RelTally> {
  const ids = new Set(graph.nodes.map(n => n.id))
  const total = new Map<VaultRel, number>()
  const rendered = new Map<VaultRel, number>()
  for (const e of graph.edges) {
    total.set(e.rel, (total.get(e.rel) ?? 0) + 1)
    if (ids.has(e.src) && ids.has(e.dst)) rendered.set(e.rel, (rendered.get(e.rel) ?? 0) + 1)
  }
  return Object.fromEntries(ALL_RELS.map(r =>
    [r, { total: total.get(r) ?? 0, rendered: rendered.get(r) ?? 0 }]),
  ) as Record<VaultRel, RelTally>
}

/** The relation families that draw at least one edge; the rest are dead
 * controls (legend rows and filter chips the canvas hides). */
export function renderableRels(graph: VaultGraph): Set<VaultRel> {
  const t = relTallies(graph)
  return new Set(ALL_RELS.filter(r => t[r].rendered > 0))
}

/** The three derived skill statuses, in reading order. */
export const ALL_STATUSES: readonly SkillStatus[] = ['promoted', 'candidate', 'retired']

/** Edge stroke per relation; legible in both themes via the token sheet with a
 * literal fallback. One source for the canvas edges, the legend, and the node
 * pages' backlink rows. */
export const REL_COLOR: Record<VaultRel, string> = {
  DESCENDS_FROM: 'var(--dsw-alias-state-business-primary, #2f6fed)',
  GOVERNS: 'var(--dsw-alias-state-success-primary, #2e9e5b)',
  REQUIRES: 'var(--dsw-alias-state-error-primary, #d94040)',
  PROVIDES: 'var(--dsw-alias-label-secondary, #6b7280)',
  BINDS: 'var(--dsw-alias-label-tertiary, #9aa1ac)',
  EVIDENCED_BY: 'var(--dsw-alias-label-tertiary, #9aa1ac)',
  CLAIMS: 'var(--dsw-alias-state-business-primary, #2f6fed)',
  SUPERSEDES: 'var(--dsw-alias-state-warning-primary, #d98a1f)',
  MOUNTED_IN: 'var(--dsw-alias-label-tertiary, #9aa1ac)',
}

/** Primary hue per node kind, orthogonal to skill status: skill=blue,
 * package=green, capability=violet. Drives the node silhouette stroke, the
 * MiniMap dot, and the legend. Status rides a secondary channel (§5.4). */
export const KIND_COLOR: Record<VaultKind, string> = {
  skill: 'var(--dsw-alias-state-business-primary, #2f6fed)',
  package: 'var(--dsw-alias-state-success-primary, #2e9e5b)',
  capability: 'var(--dsw-alias-state-purple-primary, #8b5cf6)',
}

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

/** Everything the canvas draws: positioned nodes plus the edges to paint. */
export interface VaultLayout {
  nodes: LaidOutNode[]
  edges: LaidOutEdge[]
}

/** Fixed node footprints for the deterministic dagre pass (React Flow measures
 * after mount, but the layout wants stable inputs). */
export const NODE_SIZE: Record<VaultKind, { width: number; height: number }> = {
  skill: { width: 210, height: 74 },
  package: { width: 190, height: 58 },
  capability: { width: 180, height: 52 },
}

/** Global dagre LR spacing (px). `ranksep` is the left→right gap between ranks
 * (roomy so a lineage chain reads as a clear horizontal run); `nodesep` is the
 * vertical gap between nodes sharing a rank (tight so parallel rows stack
 * evenly without wasting height). `network-simplex` gives the most compact,
 * evenly-aligned ranking at this node count. */
const DAGRE_GRAPH = {
  rankdir: 'LR', ranker: 'network-simplex',
  ranksep: 96, nodesep: 26, marginx: 20, marginy: 20,
} as const

/**
 * Fold the graph into ONE global dagre left-to-right layout over the nodes that
 * pass the kind/status filter. Every edge whose endpoints are both visible
 * nodes seeds the dagre pass — independent of the relation chips — so a node's
 * position is stable when a relation family is toggled; the chips change only
 * which edges paint. Skill lineage (DESCENDS_FROM: child→parent) therefore lays
 * out as a horizontal chain, and because the cross-kind families point at
 * capabilities (REQUIRES: skill→capability, PROVIDES: package→capability),
 * capabilities settle into the rightmost ranks with no container needed.
 *
 * An edge paints only when both endpoints survive and its relation is selected.
 * Relations whose target is a task/campaign/evidence id (GOVERNS, BINDS,
 * EVIDENCED_BY, MOUNTED_IN) have no node to land on, so they neither seed the
 * layout nor paint — {@link renderableRels} reports which families appear. A
 * node dimmed by search still lays out (context) but renders muted.
 * @param graph - the board vault payload.
 * @param f - the live filter selection.
 * @returns positioned nodes and the edges to paint.
 */
export function layout(graph: VaultGraph, f: VaultFilters): VaultLayout {
  const kindPass = new Map(graph.nodes
    .filter(n => (f.kinds.size === 0 || f.kinds.has(n.kind))
      && !(n.kind === 'skill' && f.statuses.size > 0 && !f.statuses.has(n.status)))
    .map(n => [n.id, n]))
  // Layout seed: every node-to-node edge among the survivors, chips or not.
  const nodeEdges = graph.edges.filter(e => kindPass.has(e.src) && kindPass.has(e.dst))

  const g = new dagre.graphlib.Graph()
  g.setGraph({ ...DAGRE_GRAPH })
  g.setDefaultEdgeLabel(() => ({}))
  for (const [id, node] of kindPass) g.setNode(id, { ...NODE_SIZE[node.kind] })
  for (const e of nodeEdges) g.setEdge(e.src, e.dst)
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
  const relOk = (rel: VaultRel): boolean => f.rels.size === 0 || f.rels.has(rel)
  const edges: LaidOutEdge[] = nodeEdges.filter(e => relOk(e.rel)).map(e => ({
    id: `${e.rel}:${e.src}->${e.dst}`,
    source: e.src, target: e.dst, rel: e.rel, label: e.rel,
  }))
  return { nodes, edges }
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
