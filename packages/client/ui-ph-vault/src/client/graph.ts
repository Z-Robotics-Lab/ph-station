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
  | 'IN_CLASS' | 'DEPENDS_ON' | 'BOUND_TO' | 'EVIDENCED_ON' | 'INSTANCE_OF'

/** The five node kinds the fold emits (class / benchmark group the skill library). */
export type VaultKind = 'skill' | 'class' | 'benchmark' | 'package' | 'capability'

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

/** One executor binding of a library skill on an embodiment. */
export interface SkillBinding {
  readonly transport?: string
  readonly ref?: string | null
  readonly checkpoint_sha?: string | null
}

/** Library evidence on one embodiment: whole-record n/k plus per-executor rows. */
export interface LibEvidence {
  readonly n?: number | null
  readonly k?: number | null
  readonly by_executor?: Record<string, { n?: number | null; k?: number | null }>
}

/** A skill-library record (harness.protocol SkillRecordV0, status "library"). */
export interface LibrarySkillNode {
  readonly kind: 'skill'
  readonly id: string
  readonly status: 'library'
  readonly name: string
  readonly skill_kind?: string
  readonly class?: string
  readonly description?: string
  readonly args?: Record<string, string>
  readonly requires?: string[]
  readonly ensures?: string[]
  readonly clobbers?: string[]
  readonly limits?: Record<string, unknown>
  readonly failure_modes?: string[]
  readonly bindings?: Record<string, Record<string, SkillBinding>>
  readonly evidence?: Record<string, LibEvidence>
  /** Generic skills only: how many INSTANCE_OF records collapse under this one. */
  readonly instances?: number
  readonly annotations?: VaultAnnotation | null
}

/** A class node: one row of the 技能库 tree (`skills` = member count). */
export interface ClassNode {
  readonly kind: 'class'
  readonly id: string
  readonly name?: string
  readonly skills?: number
  readonly count?: number
  readonly annotations?: VaultAnnotation | null
}

/** A benchmark node: one card's `[benchmarks.<name>]` table. */
export interface BenchmarkNode {
  readonly kind: 'benchmark'
  readonly id: string
  readonly name?: string
  readonly embodiment?: string | null
  readonly tasks?: string[]
  readonly arms?: string[]
  readonly card?: string
  readonly annotations?: VaultAnnotation | null
}

/** Any skill node: a legacy sealed record or a library record. */
export type SkillNode = LegacySkillNode | LibrarySkillNode

/** Whether a node is a library skill (the class-tree kind). */
export const isLibrary = (n: VaultNode | undefined): n is LibrarySkillNode =>
  n !== undefined && n.kind === 'skill' && n.status === 'library'

/** A legacy skill node body (a promoted/candidate/retired SkillRecord). */
export interface LegacySkillNode {
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
export type VaultNode = SkillNode | ClassNode | BenchmarkNode | PackageNode | CapabilityNode

/** One directed, typed edge with its mechanical derivation `rule` and `via`. */
export interface VaultEdge {
  readonly rel: VaultRel
  readonly src: string
  readonly dst: string
  readonly rule: string
  readonly via: string
  /** EVIDENCED_ON only: the skill's n/k on the benchmark's embodiment. */
  readonly n?: number | null
  readonly k?: number | null
  /** Overview only: how many fold edges this class-level edge aggregates. */
  readonly count?: number
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
  'IN_CLASS', 'DEPENDS_ON', 'BOUND_TO', 'EVIDENCED_ON', 'INSTANCE_OF',
]

/** The kinds, in reading order. */
export const ALL_KINDS: readonly VaultKind[] = ['skill', 'class', 'benchmark', 'package', 'capability']

/** The two highest-volume cross-band families (seven edges each in the live
 * fold), both terminating on the capability band. Hidden by default so the
 * graph opens legible; the operator opts them back in per relation chip. */
export const DENSE_RELS: readonly VaultRel[] = ['REQUIRES', 'PROVIDES']

/** Per-relation edge tally over the whole fold. `total` counts every fold edge
 * of the family; `rendered` counts only those whose both endpoints are node
 * kinds and can therefore draw. */
export interface RelTally { readonly total: number; readonly rendered: number }

/**
 * Tally every relation family's fold edges against how many can render (both
 * endpoints are nodes). Families whose targets are tasks/campaigns/evidence
 * (GOVERNS/BINDS/EVIDENCED_BY/MOUNTED_IN) tally `rendered: 0`.
 * @param graph - the folded vault graph.
 * @returns a tally for every relation family, including zero-edge ones.
 */
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

/**
 * The relation families that draw at least one edge; the rest are dead
 * controls (legend rows and filter chips the canvas hides).
 * @param graph - the folded vault graph.
 * @returns the relation families with at least one rendered edge.
 */
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
  IN_CLASS: 'var(--dsw-alias-state-warning-primary, #d98a1f)',
  DEPENDS_ON: 'var(--dsw-alias-state-error-primary, #d94040)',
  BOUND_TO: 'var(--dsw-alias-state-success-primary, #2e9e5b)',
  EVIDENCED_ON: 'var(--dsw-alias-state-purple-primary, #8b5cf6)',
  INSTANCE_OF: 'var(--dsw-alias-label-tertiary, #9aa1ac)',
}

/** Primary hue per node kind, orthogonal to skill status: skill=blue,
 * package=green, capability=violet. Drives the node silhouette stroke, the
 * MiniMap dot, and the legend. Status rides a secondary channel (§5.4). */
export const KIND_COLOR: Record<VaultKind, string> = {
  skill: 'var(--dsw-alias-state-business-primary, #2f6fed)',
  class: 'var(--dsw-alias-state-warning-primary, #d98a1f)',
  benchmark: 'var(--dsw-alias-state-purple-primary, #8b5cf6)',
  package: 'var(--dsw-alias-state-success-primary, #2e9e5b)',
  capability: 'var(--dsw-alias-state-purple-primary, #8b5cf6)',
}

/**
 * Whether a node passes the current kind/status/search filters.
 * @param node - the vault node to test.
 * @param f - the active filters; empty sets and a blank search hide nothing.
 * @returns true when every active filter admits the node.
 */
export function nodeVisible(node: VaultNode, f: VaultFilters): boolean {
  if (f.kinds.size > 0 && !f.kinds.has(node.kind)) return false
  if (node.kind === 'skill' && f.statuses.size > 0 && !f.statuses.has(node.status as SkillStatus)) return false
  return matches(node, f.search)
}

/** Client-side substring search over id / name / task / label / description. */
export function matches(node: VaultNode, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (q === '') return true
  const n = node as { task?: string; label?: string; name?: string; description?: string }
  return [node.id, n.task, n.label, n.name, n.description]
    .filter((s): s is string => typeof s === 'string').join(' ').toLowerCase().includes(q)
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
  skill: { width: 210, height: 88 },
  class: { width: 170, height: 52 },
  benchmark: { width: 190, height: 58 },
  package: { width: 190, height: 58 },
  capability: { width: 180, height: 52 },
}

/** A node's footprint: fixed per kind, except a class grows with its skill
 * count so the overview reads size ∝ membership (capped at 40 skills). */
export function nodeSize(node: VaultNode): { width: number; height: number } {
  if (node.kind !== 'class') return NODE_SIZE[node.kind]
  const s = Math.min(node.skills ?? node.count ?? 0, 40)
  return { width: NODE_SIZE.class.width + 3 * s, height: NODE_SIZE.class.height + s }
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
      && !(n.kind === 'skill' && f.statuses.size > 0 && !f.statuses.has(n.status as SkillStatus)))
    .map(n => [n.id, n]))
  // Layout seed: every node-to-node edge among the survivors, chips or not.
  const nodeEdges = graph.edges.filter(e => kindPass.has(e.src) && kindPass.has(e.dst))

  const g = new dagre.graphlib.Graph()
  g.setGraph({ ...DAGRE_GRAPH })
  g.setDefaultEdgeLabel(() => ({}))
  for (const [id, node] of kindPass) g.setNode(id, { ...nodeSize(node) })
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
    source: e.src, target: e.dst, rel: e.rel, label: e.count === undefined ? e.rel : `${e.rel} ×${e.count}`,
  }))
  return { nodes, edges }
}

/**
 * In-edges (backlinks) of one node.
 * @param graph - the folded vault graph.
 * @param id - the node id.
 * @returns every edge whose destination is the node, in fold order.
 */
export function backlinks(graph: VaultGraph, id: string): VaultEdge[] {
  return graph.edges.filter(e => e.dst === id)
}

/**
 * Out-edges of one node.
 * @param graph - the folded vault graph.
 * @param id - the node id.
 * @returns every edge whose source is the node, in fold order.
 */
export function outEdges(graph: VaultGraph, id: string): VaultEdge[] {
  return graph.edges.filter(e => e.src === id)
}

/**
 * Index nodes by id for O(1) page lookup.
 * @param graph - the folded vault graph.
 * @returns a Map from node id to its node.
 */
export function indexNodes(graph: VaultGraph): Map<string, VaultNode> {
  return new Map(graph.nodes.map(n => [n.id, n]))
}

// --- client-side index: by kind, adjacency by relation -----------------------

/** Adjacency over the fold: out/in edges per node id, in fold order. */
export interface VaultIndex {
  readonly byId: Map<string, VaultNode>
  readonly byKind: Map<VaultKind, VaultNode[]>
  readonly outs: Map<string, VaultEdge[]>
  readonly ins: Map<string, VaultEdge[]>
}

/**
 * Index the fold once per load: nodes by id and kind, edges by endpoint. Every
 * list keeps the fold's deterministic order, so the tree and pages render stably.
 * @param graph - the folded vault graph.
 * @returns the index.
 */
export function indexGraph(graph: VaultGraph): VaultIndex {
  const byKind = new Map<VaultKind, VaultNode[]>()
  for (const n of graph.nodes) byKind.set(n.kind, [...(byKind.get(n.kind) ?? []), n])
  const outs = new Map<string, VaultEdge[]>()
  const ins = new Map<string, VaultEdge[]>()
  for (const e of graph.edges) {
    outs.set(e.src, [...(outs.get(e.src) ?? []), e])
    ins.set(e.dst, [...(ins.get(e.dst) ?? []), e])
  }
  return { byId: indexNodes(graph), byKind, outs, ins }
}

/** Out-edges of `id`, optionally one relation only. */
export const outOf = (x: VaultIndex, id: string, rel?: VaultRel): VaultEdge[] =>
  (x.outs.get(id) ?? []).filter(e => rel === undefined || e.rel === rel)

/** In-edges of `id`, optionally one relation only. */
export const inTo = (x: VaultIndex, id: string, rel?: VaultRel): VaultEdge[] =>
  (x.ins.get(id) ?? []).filter(e => rel === undefined || e.rel === rel)

/** Whole-record evidence summed over embodiments (k successes of n trials). */
export function evidenceSummary(n: LibrarySkillNode): { n: number; k: number } {
  let tn = 0, tk = 0
  for (const ev of Object.values(n.evidence ?? {})) { tn += ev.n ?? 0; tk += ev.k ?? 0 }
  return { n: tn, k: tk }
}

/** The tree's filters: a benchmark id, an embodiment key, a search string (each blank = all). */
export interface TreeFilters {
  readonly benchmark: string
  readonly embodiment: string
  readonly search: string
}

/** One generic skill with the instances that nest under it in the tree. */
export interface SkillGroup { readonly node: LibrarySkillNode; readonly instances: LibrarySkillNode[] }

/** One class row of the tree: every (filtered) member in `skills` (the count)
 * and the same members nested as generic → instances in `roots`. */
export interface ClassRow { readonly node: ClassNode; readonly skills: LibrarySkillNode[]; readonly roots: SkillGroup[] }

/** The generic a skill is an INSTANCE_OF, or undefined for a generic skill. */
export const genericOf = (x: VaultIndex, id: string): string | undefined => outOf(x, id, 'INSTANCE_OF')[0]?.dst

/** The left column: class rows (IN_CLASS members, filtered) plus the legacy
 * nodes (packages, capabilities, sealed skills) under one trailing section. */
export interface ClassTree { readonly classes: ClassRow[]; readonly legacy: VaultNode[] }

/** Whether a library skill passes the benchmark / embodiment / search filters. */
export function skillPasses(x: VaultIndex, n: LibrarySkillNode, f: TreeFilters): boolean {
  if (f.benchmark !== '' && !outOf(x, n.id, 'EVIDENCED_ON').some(e => e.dst === f.benchmark)) return false
  if (f.embodiment !== '' && !(f.embodiment in (n.bindings ?? {}))) return false
  return matches(n, f.search)
}

/**
 * Fold the index into the class tree. A class row survives only with at least
 * one passing member; the legacy section is search-filtered only.
 * @param x - the index.
 * @param f - the tree filters.
 * @returns the tree, in fold order.
 */
export function classTree(x: VaultIndex, f: TreeFilters): ClassTree {
  const classes: ClassRow[] = []
  for (const c of (x.byKind.get('class') ?? []) as ClassNode[]) {
    const skills = inTo(x, c.id, 'IN_CLASS').map(e => x.byId.get(e.src))
      .filter((n): n is LibrarySkillNode => isLibrary(n) && skillPasses(x, n, f))
    if (skills.length === 0) continue
    // Nest an instance under its generic only when the generic also passes;
    // otherwise it stays a root so the filter never hides a survivor.
    const ids = new Set(skills.map(s => s.id))
    const under = (s: LibrarySkillNode): string | undefined => {
      const g = genericOf(x, s.id)
      return g !== undefined && ids.has(g) ? g : undefined
    }
    // ponytail: O(n²) per class; index by generic if a class passes ~1k skills.
    const roots = skills.filter(s => under(s) === undefined).map(node => ({ node, instances: skills.filter(s => under(s) === node.id) }))
    classes.push({ node: c, skills, roots })
  }
  const legacy = [...(x.byKind.get('skill') ?? []).filter(n => !isLibrary(n)),
    ...(x.byKind.get('package') ?? []), ...(x.byKind.get('capability') ?? [])]
    .filter(n => matches(n, f.search))
  return { classes, legacy }
}

/** Every embodiment key any library skill binds, sorted. */
export function embodiments(x: VaultIndex): string[] {
  const keys = new Set<string>()
  for (const n of x.byKind.get('skill') ?? []) if (isLibrary(n)) for (const k of Object.keys(n.bindings ?? {})) keys.add(k)
  return [...keys].sort()
}

/** The skill-level relations the overview aggregates to class level. */
const AGG_RELS: readonly VaultRel[] = ['DEPENDS_ON', 'BOUND_TO', 'EVIDENCED_ON']

/**
 * The no-selection canvas: every class node, the benchmark / package nodes at
 * least one class edge touches, and one aggregated edge per (relation, class,
 * target) pair carrying the fold-edge `count` — no skill nodes at all, so 100+
 * skills and their dense DEPENDS_ON family read as a dozen classes.
 * @param graph - the folded vault graph.
 * @param x - its index.
 * @returns the class overview as a graph.
 */
export function overview(graph: VaultGraph, x: VaultIndex): VaultGraph {
  const classOf = (id: string): string | undefined => outOf(x, id, 'IN_CLASS')[0]?.dst
  const agg = new Map<string, VaultEdge>()
  for (const e of graph.edges) {
    if (!AGG_RELS.includes(e.rel)) continue
    const src = classOf(e.src)
    const dst = e.rel === 'DEPENDS_ON' ? classOf(e.dst) : e.dst
    if (src === undefined || dst === undefined || src === dst) continue
    const key = `${e.rel}:${src}->${dst}`
    const prev = agg.get(key)
    agg.set(key, prev === undefined
      ? { rel: e.rel, src, dst, rule: e.rule, via: 'overview', count: 1 }
      : { ...prev, count: (prev.count ?? 0) + 1 })
  }
  const edges = [...agg.values()]
  const touched = new Set(edges.flatMap(e => [e.src, e.dst]))
  const nodes = graph.nodes.filter(n => n.kind === 'class' || ((n.kind === 'benchmark' || n.kind === 'package') && touched.has(n.id)))
  return { ...graph, nodes, edges }
}

/** What the selection's neighborhood unfolds: the generic skills whose
 * instances draw, and whether a library skill reaches depth 2. */
export interface NeighborhoodOpts { readonly expanded: ReadonlySet<string>; readonly deep: boolean }

const COLLAPSED: NeighborhoodOpts = { expanded: new Set(), deep: false }

/**
 * The subgraph the canvas draws for a selection: a class → itself, its generic
 * skills (no INSTANCE_OF out-edge), and their DEPENDS_ON / BOUND_TO /
 * EVIDENCED_ON neighbors; a library skill → its depth-1 neighbors (depth 2 with
 * `deep`); any other node → its depth-2 neighborhood; no selection → the class
 * {@link overview}. Instances stay collapsed under their generic (the node
 * badge shows `+n`) until the generic is in `expanded`; a class's members never
 * unfold through a depth-2 IN_CLASS hop.
 * Node and edge order follow the fold (deterministic layout input).
 * @param graph - the folded vault graph.
 * @param x - its index.
 * @param selected - the selected node id, or null.
 * @param opts - expanded generics and the depth toggle.
 * @returns the neighborhood as a graph.
 */
export function neighborhood(graph: VaultGraph, x: VaultIndex, selected: string | null, opts: NeighborhoodOpts = COLLAPSED): VaultGraph {
  const sel = selected === null ? undefined : x.byId.get(selected)
  if (selected === null || sel === undefined) return overview(graph, x)
  const keep = new Set<string>([selected])
  if (sel.kind === 'class') {
    for (const e of inTo(x, selected, 'IN_CLASS')) {
      if (genericOf(x, e.src) !== undefined) continue
      keep.add(e.src)
      for (const out of outOf(x, e.src)) if (out.rel !== 'IN_CLASS') keep.add(out.dst)
      for (const inn of inTo(x, e.src)) if (inn.rel === 'DEPENDS_ON' || (inn.rel === 'INSTANCE_OF' && opts.expanded.has(e.src))) keep.add(inn.src)
    }
  } else {
    // In-edges to follow: never a class's members (IN_CLASS), a generic's
    // instances (INSTANCE_OF) only once it is expanded.
    const follow = (e: VaultEdge, into: string): boolean =>
      e.rel !== 'IN_CLASS' && (e.rel !== 'INSTANCE_OF' || opts.expanded.has(into))
    let frontier = [selected]
    const depths = isLibrary(sel) && !opts.deep ? 1 : 2
    for (let depth = 0; depth < depths; depth++) {
      const next: string[] = []
      for (const id of frontier) {
        for (const e of outOf(x, id)) if (!keep.has(e.dst)) { keep.add(e.dst); next.push(e.dst) }
        for (const e of inTo(x, id)) if (follow(e, id) && !keep.has(e.src)) { keep.add(e.src); next.push(e.src) }
      }
      frontier = next
    }
  }
  return {
    ...graph,
    nodes: graph.nodes.filter(n => keep.has(n.id)),
    edges: graph.edges.filter(e => keep.has(e.src) && keep.has(e.dst)),
  }
}
