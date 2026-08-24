/**
 * Pure fold: the board vault payload → the wiki graph's view model plus its
 * dagre layout. Rendering-state assembly only — every number, status, and
 * relation is copied verbatim from board/vault.py (the deterministic fold);
 * nothing is computed here (charter: TS renders only).
 *
 * The vault is a typed, backlinked graph over three node kinds (skill /
 * package / capability) and a fixed nine-relation edge vocabulary. This module
 * mirrors board/vault.py's output as TypeScript, filters it by the operator's
 * kind/status/relation chips, and lays the survivors out grouped by kind into
 * titled regions (skills sub-clustered by task family), each region running its
 * own dagre left-to-right pass so lineage (DESCENDS_FROM) reads as a chain.
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
 * package=green, capability=violet. Drives the node silhouette stroke, the kind
 * container tint, and the legend. Status rides a secondary channel (§5.4). */
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

/** A background cluster rectangle drawn behind the nodes: one `band` per kind
 * region (技能/机箱卡/能力) plus one `task` sub-container per skill task family.
 * Non-interactive; its title and hue come from `kind`. `title` carries the task
 * name for `task` variants and is unused (derived from `kind`) for `band`. */
export interface LaidOutContainer {
  id: string
  kind: VaultKind
  variant: 'band' | 'task'
  title: string
  position: { x: number; y: number }
  width: number
  height: number
}

/** Everything the canvas draws: positioned nodes, labeled edges, cluster boxes. */
export interface VaultLayout {
  nodes: LaidOutNode[]
  edges: LaidOutEdge[]
  containers: LaidOutContainer[]
}

/** Fixed node footprints for the deterministic dagre pass (React Flow measures
 * after mount, but the layout wants stable inputs). */
export const NODE_SIZE: Record<VaultKind, { width: number; height: number }> = {
  skill: { width: 210, height: 74 },
  package: { width: 190, height: 58 },
  capability: { width: 180, height: 52 },
}

/** Spacing for the grouped layout (px). Kind regions stack top-to-bottom; skill
 * task families pack left-to-right inside the skill region. */
const BAND_GAP = 44
const BAND_TITLE_H = 30
const BAND_PAD = 18
const TASK_TITLE_H = 20
const TASK_PAD = 12
const TASK_GAP = 26

/** One dagre LR pass over a sub-group, normalized to a (0,0) top-left origin.
 * Only edges internal to the sub-group influence the pass — cross-group edges
 * route freely afterward and must not distort a cluster's internal ranking.
 * @param members - the nodes in this sub-group.
 * @param edges - the full surviving edge set (filtered to internal here).
 * @returns each member's top-left position plus the sub-group's extent.
 */
function dagreSub(
  members: VaultNode[], edges: VaultEdge[],
): { pos: Map<string, { x: number; y: number }>; width: number; height: number } {
  if (members.length === 0) return { pos: new Map(), width: 0, height: 0 }
  const ids = new Set(members.map(n => n.id))
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 20, ranksep: 80, marginx: 6, marginy: 6 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of members) g.setNode(n.id, { ...NODE_SIZE[n.kind] })
  for (const e of edges) if (ids.has(e.src) && ids.has(e.dst)) g.setEdge(e.src, e.dst)
  dagre.layout(g)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const raw = new Map<string, { x: number; y: number }>()
  for (const n of members) {
    const p = g.node(n.id)
    const x = p.x - p.width / 2, y = p.y - p.height / 2
    raw.set(n.id, { x, y })
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + p.width); maxY = Math.max(maxY, y + p.height)
  }
  const pos = new Map<string, { x: number; y: number }>()
  for (const [id, r] of raw) pos.set(id, { x: r.x - minX, y: r.y - minY })
  return { pos, width: maxX - minX, height: maxY - minY }
}

/** Wrap an edgeless group into a compact row grid (dagre would stack same-rank
 * nodes into one tall column, wasting vertical space and colliding with the
 * legend). Rows of at most `PER_ROW`, normalized to a (0,0) origin.
 * @param members - the nodes in this sub-group.
 * @returns each member's top-left position plus the grid's extent.
 */
function rowLayout(
  members: VaultNode[],
): { pos: Map<string, { x: number; y: number }>; width: number; height: number } {
  const GAP_X = 26, GAP_Y = 20, PER_ROW = 4
  const pos = new Map<string, { x: number; y: number }>()
  let x = 0, y = 0, rowH = 0, col = 0, right = 0, bottom = 0
  for (const n of members) {
    const size = NODE_SIZE[n.kind]
    pos.set(n.id, { x, y })
    right = Math.max(right, x + size.width)
    bottom = Math.max(bottom, y + size.height)
    x += size.width + GAP_X
    rowH = Math.max(rowH, size.height)
    if (++col === PER_ROW) { x = 0; y += rowH + GAP_Y; rowH = 0; col = 0 }
  }
  return { pos, width: right, height: bottom }
}

/** Position a sub-group: dagre LR when it has internal edges (lineage reads as a
 * chain), else a compact row grid. Normalized to a (0,0) top-left origin.
 * @param members - the nodes in this sub-group.
 * @param edges - the full surviving edge set (filtered to internal here).
 * @returns each member's top-left position plus the sub-group's extent.
 */
function packGroup(
  members: VaultNode[], edges: VaultEdge[],
): { pos: Map<string, { x: number; y: number }>; width: number; height: number } {
  const ids = new Set(members.map(n => n.id))
  const hasInternal = edges.some(e => ids.has(e.src) && ids.has(e.dst))
  return hasInternal ? dagreSub(members, edges) : rowLayout(members)
}

/** Task family of a skill node; untasked skills share one bucket. */
function taskOf(n: SkillNode): string {
  return n.task && n.task.trim() !== '' ? n.task : '—'
}

/**
 * Fold the graph into a GROUPED layout over the FILTERED subset: each kind
 * (skill / package / capability) lays out through its own pass (dagre LR when it
 * has internal edges, else a packed row grid) and stacks as a titled region;
 * skill nodes sub-cluster by task family. Cross-group
 * edges route between regions unchanged, so all nine relations stay visible.
 * An edge survives only when both endpoints do and its relation is selected; a
 * node dimmed by search still lays out (context) but renders muted.
 * @param graph - the board vault payload.
 * @param f - the live filter selection.
 * @returns positioned nodes, labeled edges, and the cluster background boxes.
 */
export function layout(graph: VaultGraph, f: VaultFilters): VaultLayout {
  const kindPass = new Map(graph.nodes
    .filter(n => (f.kinds.size === 0 || f.kinds.has(n.kind))
      && !(n.kind === 'skill' && f.statuses.size > 0 && !f.statuses.has(n.status)))
    .map(n => [n.id, n]))
  const relOk = (rel: VaultRel): boolean => f.rels.size === 0 || f.rels.has(rel)
  const edges = graph.edges.filter(e => relOk(e.rel) && kindPass.has(e.src) && kindPass.has(e.dst))

  const survivors = [...kindPass.values()]
  const q = f.search.trim().toLowerCase()
  const nodes: LaidOutNode[] = []
  const containers: LaidOutContainer[] = []
  const emit = (node: VaultNode, x: number, y: number): void => {
    nodes.push({
      id: node.id, type: node.kind, position: { x, y },
      data: { node, dimmed: q !== '' && !nodeVisible(node, f) },
    })
  }

  let bandY = 0
  let widest = 0

  // --- skill region: task-family sub-clusters packed left-to-right ----------
  const skills = survivors.filter((n): n is SkillNode => n.kind === 'skill')
  if (skills.length > 0) {
    const families = new Map<string, SkillNode[]>()
    for (const s of skills) {
      const key = taskOf(s)
      const bucket = families.get(key)
      if (bucket) bucket.push(s)
      else families.set(key, [s])
    }
    let cursorX = BAND_PAD
    let maxFamH = 0
    for (const [task, members] of families) {
      const sub = packGroup(members, edges)
      const famX = cursorX
      const famTop = bandY + BAND_TITLE_H + TASK_PAD
      const nodeX = famX + TASK_PAD
      const nodeY = famTop + TASK_TITLE_H + TASK_PAD
      for (const m of members) {
        const p = sub.pos.get(m.id) ?? { x: 0, y: 0 }
        emit(m, nodeX + p.x, nodeY + p.y)
      }
      const famW = sub.width + TASK_PAD * 2
      const famH = TASK_TITLE_H + TASK_PAD + sub.height + TASK_PAD
      containers.push({
        id: `task:${task}`, kind: 'skill', variant: 'task', title: task,
        position: { x: famX, y: famTop }, width: famW, height: famH,
      })
      maxFamH = Math.max(maxFamH, famH)
      cursorX = famX + famW + TASK_GAP
    }
    const bandW = cursorX - TASK_GAP + BAND_PAD
    const bandH = BAND_TITLE_H + TASK_PAD + maxFamH + BAND_PAD
    containers.push({
      id: 'band:skill', kind: 'skill', variant: 'band', title: '',
      position: { x: 0, y: bandY }, width: bandW, height: bandH,
    })
    widest = Math.max(widest, bandW)
    bandY += bandH + BAND_GAP
  }

  // --- package + capability regions: one packed row grid each ---------------
  for (const kind of ['package', 'capability'] as const) {
    const members = survivors.filter(n => n.kind === kind)
    if (members.length === 0) continue
    const sub = packGroup(members, edges)
    const nodeX = BAND_PAD
    const nodeY = bandY + BAND_TITLE_H + BAND_PAD
    for (const m of members) {
      const p = sub.pos.get(m.id) ?? { x: 0, y: 0 }
      emit(m, nodeX + p.x, nodeY + p.y)
    }
    const bandW = BAND_PAD * 2 + sub.width
    const bandH = BAND_TITLE_H + BAND_PAD + sub.height + BAND_PAD
    containers.push({
      id: `band:${kind}`, kind, variant: 'band', title: '',
      position: { x: 0, y: bandY }, width: bandW, height: bandH,
    })
    widest = Math.max(widest, bandW)
    bandY += bandH + BAND_GAP
  }

  // Align every region to the widest so the three lanes read as full-width rows.
  for (const c of containers) if (c.variant === 'band') c.width = widest

  const laidEdges: LaidOutEdge[] = edges.map(e => ({
    id: `${e.rel}:${e.src}->${e.dst}`,
    source: e.src, target: e.dst, rel: e.rel, label: e.rel,
  }))
  return { nodes, edges: laidEdges, containers }
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
