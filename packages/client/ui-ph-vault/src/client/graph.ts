/**
 * Pure fold: the board vault payload → the wiki graph's view model plus its
 * layered layout. Rendering-state assembly only — every number, status, and
 * relation is copied verbatim from board/vault.py (the deterministic fold);
 * nothing is computed here (charter: TS renders only).
 *
 * The vault is a typed, backlinked graph over five node kinds and a fixed
 * relation vocabulary. This module mirrors board/vault.py's output as
 * TypeScript, indexes it, folds the class tree, and lays the canvas out in
 * three fixed columns — 能力 (capability) | 卡片 (card) | 技能 (skill, one
 * swimlane per class) — by stacking nodes with gaps (no force/dagre pass), so
 * the layers the operator asked about are the columns themselves.
 */

/** The fixed relation vocabulary (board/vault.py §2.5); edges carry one each. */
export type VaultRel =
  | 'DESCENDS_FROM' | 'GOVERNS' | 'REQUIRES' | 'PROVIDES' | 'BINDS'
  | 'EVIDENCED_BY' | 'CLAIMS' | 'SUPERSEDES' | 'MOUNTED_IN'
  | 'IN_CLASS' | 'DEPENDS_ON' | 'BOUND_TO' | 'EVIDENCED_ON' | 'INSTANCE_OF'
  | 'COVERS' | 'USES'

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
  /** The mission cards it COVERS (package ids), verbatim from the fold. */
  readonly missions?: string[]
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
  /** Mission cards: the tasks they run and the skill ids they USES, verbatim from the fold. */
  readonly tasks?: string[]
  readonly skills?: string[]
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

/** Every relation, in reading order (the chip row + edge legend). */
export const ALL_RELS: readonly VaultRel[] = [
  'DESCENDS_FROM', 'GOVERNS', 'REQUIRES', 'PROVIDES', 'BINDS',
  'EVIDENCED_BY', 'CLAIMS', 'SUPERSEDES', 'MOUNTED_IN',
  'IN_CLASS', 'DEPENDS_ON', 'BOUND_TO', 'EVIDENCED_ON', 'INSTANCE_OF', 'COVERS', 'USES',
]

/** The kinds, in reading order. */
export const ALL_KINDS: readonly VaultKind[] = ['skill', 'class', 'benchmark', 'package', 'capability']

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
  COVERS: 'var(--dsw-alias-state-purple-primary, #8b5cf6)',
  USES: 'var(--dsw-alias-state-purple-primary, #8b5cf6)',
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

/** Client-side substring search over id / name / task / label / description. */
export function matches(node: VaultNode, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (q === '') return true
  const n = node as { task?: string; label?: string; name?: string; description?: string }
  return [node.id, n.task, n.label, n.name, n.description]
    .filter((s): s is string => typeof s === 'string').join(' ').toLowerCase().includes(q)
}

/** Fixed node footprints (React Flow measures after mount, but the stacked
 * layout wants stable inputs). */
export const NODE_SIZE: Record<VaultKind, { width: number; height: number }> = {
  skill: { width: 210, height: 88 },
  class: { width: 170, height: 52 },
  benchmark: { width: 190, height: 58 },
  package: { width: 190, height: 58 },
  capability: { width: 180, height: 52 },
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

/** The left column: class rows (IN_CLASS members, filtered), the 卡片与能力
 * section (packages + capabilities), and the 历史记录 section (legacy sealed
 * skills; shown only behind the 历史 toggle). */
export interface ClassTree { readonly classes: ClassRow[]; readonly cards: VaultNode[]; readonly legacy: LegacySkillNode[] }

/** Whether a library skill passes the benchmark / embodiment / search filters. */
export function skillPasses(x: VaultIndex, n: LibrarySkillNode, f: TreeFilters): boolean {
  if (f.benchmark !== '' && !outOf(x, n.id, 'EVIDENCED_ON').some(e => e.dst === f.benchmark)) return false
  if (f.embodiment !== '' && !(f.embodiment in (n.bindings ?? {}))) return false
  return matches(n, f.search)
}

/**
 * Fold the index into the class tree. A class row survives only with at least
 * one passing member; the cards and legacy sections are search-filtered only.
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
  const cards = [...(x.byKind.get('package') ?? []), ...(x.byKind.get('capability') ?? [])].filter(n => matches(n, f.search))
  const legacy = legacySkills(x).filter(n => matches(n, f.search))
  return { classes, cards, legacy }
}

/** The legacy sealed records (runs history: promoted / candidate / retired), in fold order. */
export const legacySkills = (x: VaultIndex): LegacySkillNode[] =>
  (x.byKind.get('skill') ?? []).filter((n): n is LegacySkillNode => n.kind === 'skill' && !isLibrary(n))

/** Every embodiment key any library skill binds, sorted. */
export function embodiments(x: VaultIndex): string[] {
  const keys = new Set<string>()
  for (const n of x.byKind.get('skill') ?? []) if (isLibrary(n)) for (const k of Object.keys(n.bindings ?? {})) keys.add(k)
  return [...keys].sort()
}

/** Class-level DEPENDS_ON: `a → (b → count)` over the members' fold edges
 * (each endpoint resolved by IN_CLASS), a ≠ b. One source for the lane order,
 * the class page's 依赖的类 / 被依赖的类 lists, and the canvas arcs. */
export function classDeps(x: VaultIndex): Map<string, Map<string, number>> {
  const cls = (id: string): string | undefined => outOf(x, id, 'IN_CLASS')[0]?.dst
  const out = new Map<string, Map<string, number>>()
  for (const e of [...x.outs.values()].flat()) {
    if (e.rel !== 'DEPENDS_ON') continue
    const a = cls(e.src), b = cls(e.dst)
    if (a === undefined || b === undefined || a === b) continue
    const m = out.get(a) ?? new Map<string, number>()
    m.set(b, (m.get(b) ?? 0) + 1)
    out.set(a, m)
  }
  return out
}

/** Skill kinds whose contract only re-asserts state (a checker's requires =
 * ensures), so their class depends on and is depended on by every motion
 * class at once; their lanes sort after the motion lanes. */
const CHECKER_KINDS = new Set(['verify', 'decide', 'perceive', 'plan'])

/**
 * The class lanes in dependency order: a class sits below every class it
 * DEPENDS_ON (aggregated by {@link classDeps}), so the arcs point one way.
 * Motion classes first (nav → grasp → carry → …), checker classes after them;
 * within a group a mutual pair keeps its heavier direction (a tie constrains
 * nothing), a longer cycle breaks at the class with the least unmet weight,
 * and ties fall alphabetical.
 * @param x - the index.
 * @returns the class nodes, lane order.
 */
export function laneOrder(x: VaultIndex): ClassNode[] {
  const classes = (x.byKind.get('class') ?? []) as ClassNode[]
  const deps = classDeps(x)
  const w = (a: string, b: string): number => deps.get(a)?.get(b) ?? 0
  const checker = (c: ClassNode): boolean => {
    const members = inTo(x, c.id, 'IN_CLASS').map(e => x.byId.get(e.src)).filter(isLibrary)
    return members.length > 0 && members.every(m => CHECKER_KINDS.has(m.skill_kind ?? 'segment'))
  }
  const order: ClassNode[] = []
  for (const group of [classes.filter(c => !checker(c)), classes.filter(checker)]) {
    const left = new Set(group.map(c => c.id))
    // Unmet weight: the kept (heavier-direction) dependencies still in `left`.
    const unmet = (a: string): number => [...left].reduce((n, b) => n + (w(a, b) > w(b, a) ? w(a, b) : 0), 0)
    while (left.size > 0) {
      const ready = [...left].filter(a => unmet(a) === 0).sort()
      const [pick] = ready.length > 0 ? ready : [...left].sort((p, q) => unmet(p) - unmet(q) || p.localeCompare(q))
      left.delete(pick ?? '')
      order.push(...group.filter(c => c.id === pick))
    }
  }
  return order
}


// --- layered canvas: 能力 | 卡片 | 技能 ---------------------------------------

/** Which layers the canvas shows: cards (能力 + 卡片, skills added by hand),
 * skills (the class swimlanes alone), or all three columns. */
export type LayerMode = 'cards' | 'skills' | 'all'

/** The relation chips over the canvas. Each maps to one fold relation except
 * CONTRACT (requires/ensures predicate nodes drawn from the records) and
 * HISTORY (the legacy sealed records and every legacy relation). */
export type RelToggle = 'DEPENDS_ON' | 'CONTRACT' | 'INSTANCE_OF' | 'BOUND_TO' | 'USES' | 'PROVIDES' | 'MOUNTED_IN' | 'EVIDENCED_ON' | 'HISTORY'

/** The chips, in reading order. */
export const ALL_TOGGLES: readonly RelToggle[] = ['DEPENDS_ON', 'CONTRACT', 'INSTANCE_OF', 'BOUND_TO', 'USES', 'PROVIDES', 'MOUNTED_IN', 'EVIDENCED_ON', 'HISTORY']

/** The legacy relations (the runs history), all behind the 历史 chip. */
export const HISTORY_RELS: readonly VaultRel[] = ['DESCENDS_FROM', 'GOVERNS', 'REQUIRES', 'CLAIMS', 'SUPERSEDES', 'EVIDENCED_BY', 'BINDS']

/** The chip that admits a fold relation; IN_CLASS is drawn as lane membership
 * and COVERS as a mission card nested under its benchmark, never as an edge. */
export function toggleOf(rel: VaultRel): RelToggle | null {
  if (rel === 'IN_CLASS' || rel === 'COVERS') return null
  return HISTORY_RELS.includes(rel) ? 'HISTORY' : rel as RelToggle
}

/** The chips on at load: 依赖 · 实例 · 绑定 · 使用 · 提供 · 挂载, plus 证据 when
 * the fold carries at least one drawable EVIDENCED_ON edge; 前置/保证 and 历史 off. */
export function defaultToggles(graph: VaultGraph): Set<RelToggle> {
  const on = new Set<RelToggle>(['DEPENDS_ON', 'INSTANCE_OF', 'BOUND_TO', 'USES', 'PROVIDES', 'MOUNTED_IN'])
  const ids = new Set(graph.nodes.map(n => n.id))
  if (graph.edges.some(e => e.rel === 'EVIDENCED_ON' && ids.has(e.src) && ids.has(e.dst))) on.add('EVIDENCED_ON')
  return on
}

/** The canvas state the layout folds from. */
export interface LayerView {
  readonly mode: LayerMode
  readonly on: ReadonlySet<RelToggle>
  /** Classes whose swimlane unfolds to its generic skills (shared with the tree). */
  readonly openClasses: ReadonlySet<string>
  /** Generic skills whose instances unfold. */
  readonly expanded: ReadonlySet<string>
  /** Cards mode: the skill ids added to the canvas. */
  readonly added: ReadonlySet<string>
  readonly search: string
}

/** A React Flow node type: a vault kind, a class swimlane (parent group), a
 * column / sub-group header, or a requires/ensures predicate. */
export type FlowType = VaultKind | 'lane' | 'header' | 'predicate'

/** A positioned React Flow node. Children of a lane carry `parentId` and a
 * position relative to it (xyflow parent-node convention). */
export interface LaidOutNode {
  id: string
  type: FlowType
  position: { x: number; y: number }
  width: number
  height: number
  parentId?: string
  data: {
    node?: VaultNode | undefined
    /** Header / lane label: a raw string or a locale key (`key`) plus a count. */
    label?: string | undefined
    key?: string | undefined
    count?: number | undefined
    open?: boolean | undefined
    dimmed: boolean
  }
}

/** A painted edge; `requires` / `ensures` are the predicate edges. */
export type EdgeRel = VaultRel | 'requires' | 'ensures'

/** A React Flow edge with its relation label and fold-edge count. A lane→lane
 * DEPENDS_ON arc carries `offset`: how far right of the skills column it bows
 * (longer spans bow further, every arc distinct). */
export interface LaidOutEdge {
  id: string
  source: string
  target: string
  rel: EdgeRel
  label: string
  count: number
  offset?: number
}

/** Everything the canvas draws. */
export interface VaultLayout { nodes: LaidOutNode[]; edges: LaidOutEdge[] }

/** Fixed column x (px): 能力 | 卡片 | 技能 | 谓词 (predicates, 前置/保证 chip only). */
export const COL_X = { capability: 0, package: 290, skill: 620, predicate: 980 } as const

/** Edge stroke for the predicate edges (the fold relations use REL_COLOR). */
export const PRED_COLOR: Record<'requires' | 'ensures', string> = {
  requires: 'var(--dsw-alias-state-warning-primary, #d98a1f)',
  ensures: 'var(--dsw-alias-state-success-primary, #2e9e5b)',
}

const GAP = 14
const LANE_W = 270
const LANE_PAD = 20
const LANE_HEAD = 40
const INST_INDENT = 16
const HEAD_H = 26
const PRED_SIZE = { width: 200, height: 34 }
const ARC_BASE = 28
const ARC_STEP = 12

/** The cards column sub-groups, in reading order. */
export type CardGroup = 'embodiment' | 'provider' | 'mission' | 'other'
const CARD_GROUPS: readonly CardGroup[] = ['embodiment', 'provider', 'mission', 'other']

/** A card's sub-group by what it provides: an `embodiment.*` seam → 具身; any
 * other seam → 执行器/策略; a benchmark, a benchmark's card, or a `mission_*`
 * card → 任务/基准; the rest (build/skill/planner helpers) → 其他. */
export function cardGroup(n: PackageNode | BenchmarkNode, x: VaultIndex): CardGroup {
  if (n.kind === 'benchmark' || inTo(x, n.id, 'COVERS').length > 0) return 'mission'
  const provides = n.provides ?? []
  if (provides.some(c => c.startsWith('embodiment.'))) return 'embodiment'
  if (provides.length > 0) return 'provider'
  // ponytail: name heuristic for mission cards; switch to a manifest field once the fold carries one.
  const isBenchCard = (x.byKind.get('benchmark') ?? []).some(b => (b as BenchmarkNode).card === n.id)
  return isBenchCard || /mission/.test(n.id) ? 'mission' : 'other'
}

/**
 * Lay the canvas out in fixed columns. Capabilities stack in column 1; cards
 * (packages + benchmarks) stack in column 2 under their sub-group headers;
 * column 3 holds one swimlane per class (a parent node labeled `grasp · 14`):
 * header-only while collapsed, its generic skills as children once open, an
 * instance nested under its generic once that generic is expanded. Cards mode
 * draws only the lanes of the added skills; skills mode draws column 3 alone.
 * The 历史 chip adds one lane of the legacy sealed skills; the 前置/保证 chip
 * adds a fourth column of predicate nodes wired requires→skill / skill→ensures.
 *
 * Edges: a fold edge paints when its chip is on and both endpoints resolve to
 * a drawn node — a collapsed instance resolves to its generic, a member of a
 * collapsed lane to the lane — and parallel resolutions fold into one counted
 * edge (`DEPENDS_ON ×3`), so collapsed lanes read as the class overview.
 * @param graph - the board vault payload.
 * @param x - its index.
 * @param v - the canvas state.
 * @returns positioned nodes (lanes before their children) and the edges to paint.
 */
export function layered(graph: VaultGraph, x: VaultIndex, v: LayerView): VaultLayout {
  const nodes: LaidOutNode[] = []
  const q = v.search.trim()
  const dim = (n: VaultNode): boolean => q !== '' && !matches(n, q)
  const header = (id: string, key: string, xPos: number, y: number, count?: number): number => {
    nodes.push({ id, type: 'header', position: { x: xPos, y }, width: LANE_W, height: HEAD_H, data: { key, count, dimmed: false } })
    return y + HEAD_H + GAP / 2
  }
  const place = (n: VaultNode, xPos: number, y: number, parentId?: string, count?: number): number => {
    const size = NODE_SIZE[n.kind]
    nodes.push({
      id: n.id, type: n.kind, position: { x: xPos, y }, ...size,
      ...(parentId === undefined ? {} : { parentId }), data: { node: n, count, dimmed: dim(n) },
    })
    return y + size.height + GAP
  }

  if (v.mode !== 'skills') {
    const caps = x.byKind.get('capability') ?? []
    let y = header('col:capability', 'col.capability', COL_X.capability, 0, caps.length)
    for (const c of caps) y = place(c, COL_X.capability, y)

    const cards = [...(x.byKind.get('package') ?? []), ...(x.byKind.get('benchmark') ?? [])] as Array<PackageNode | BenchmarkNode>
    y = header('col:package', 'col.package', COL_X.package, 0, cards.length)
    for (const g of CARD_GROUPS) {
      const members = cards.filter(c => cardGroup(c, x) === g)
      if (members.length === 0) continue
      y = header(`group:${g}`, `group.${g}`, COL_X.package, y, members.length)
      // 任务/基准: a benchmark heads the mission cards it COVERS, indented beneath it.
      const covers = (b: VaultNode): PackageNode[] => outOf(x, b.id, 'COVERS').map(e => x.byId.get(e.dst)).filter((p): p is PackageNode => p?.kind === 'package')
      const nested = new Set(members.flatMap(m => covers(m).map(p => p.id)))
      for (const c of members) {
        if (nested.has(c.id)) continue
        const under = covers(c)
        y = place(c, COL_X.package, y, undefined, c.kind === 'benchmark' ? under.length : undefined)
        for (const p of under) y = place(p, COL_X.package + INST_INDENT, y)
      }
    }
  }

  // Column 3: one swimlane per class. Lane id = class id, so selecting the lane selects the class.
  const collapsedLanes = new Set<string>()
  const lane = (id: string, y: number, data: LaidOutNode['data'], members: VaultNode[], indent: (n: VaultNode) => number): number => {
    const head: LaidOutNode = { id, type: 'lane', position: { x: COL_X.skill, y }, width: LANE_W, height: LANE_HEAD, data }
    nodes.push(head)
    let cy = LANE_HEAD
    for (const m of members) cy = place(m, LANE_PAD + indent(m), cy, id)
    if (members.length > 0) head.height = cy - GAP + LANE_PAD / 2
    return y + head.height + GAP
  }
  const classes = laneOrder(x)
  const memberOf = (c: ClassNode): LibrarySkillNode[] => inTo(x, c.id, 'IN_CLASS').map(e => x.byId.get(e.src)).filter(isLibrary)
  let y = header('col:skill', 'col.skill', COL_X.skill, 0, classes.reduce((n, c) => n + (c.skills ?? c.count ?? 0), 0))
  for (const c of classes) {
    const all = memberOf(c)
    let shown: LibrarySkillNode[]
    if (v.mode === 'cards') {
      shown = all.filter(m => v.added.has(m.id))
      if (shown.length === 0) continue
    } else {
      shown = v.openClasses.has(c.id) ? all : []
      if (shown.length === 0) collapsedLanes.add(c.id)
    }
    // Generic → its expanded instances directly beneath, indented.
    const ids = new Set(shown.map(s => s.id))
    const gen = (s: LibrarySkillNode): string | undefined => {
      const g = genericOf(x, s.id)
      return g !== undefined && ids.has(g) ? g : undefined
    }
    const ordered = shown.filter(s => gen(s) === undefined)
      .flatMap(s => [s, ...(v.expanded.has(s.id) ? shown.filter(i => gen(i) === s.id) : [])])
    const open = shown.length > 0
    const indent = (n: VaultNode): number => (gen(n as LibrarySkillNode) === undefined ? 0 : INST_INDENT)
    y = lane(c.id, y, { node: c, label: c.name ?? c.id, count: all.length, open, dimmed: dim(c) }, ordered, indent)
  }
  const legacy = v.on.has('HISTORY') ? legacySkills(x) : []
  if (legacy.length > 0) y = lane('lane:history', y, { key: 'tree.history', count: legacy.length, open: true, dimmed: false }, legacy, () => 0)

  // Predicate column: every requires/ensures ref of a drawn library skill, once.
  const drawnSkills = nodes.map(n => n.data.node).filter(isLibrary)
  if (v.on.has('CONTRACT')) {
    const preds = [...new Set(drawnSkills.flatMap(s => [...(s.requires ?? []), ...(s.ensures ?? [])]))]
    let py = header('col:predicate', 'col.predicate', COL_X.predicate, 0, preds.length)
    for (const p of preds) {
      nodes.push({ id: `pred:${p}`, type: 'predicate', position: { x: COL_X.predicate, y: py }, ...PRED_SIZE, data: { label: p, dimmed: false } })
      py += PRED_SIZE.height + GAP
    }
  }

  // Edges: resolve each endpoint to the node that stands for it on this canvas.
  const drawn = new Set(nodes.filter(n => n.type !== 'header').map(n => n.id))
  const anchor = (id: string): string | undefined => {
    if (drawn.has(id)) return id
    const n = x.byId.get(id)
    if (!isLibrary(n)) return undefined
    const g = genericOf(x, id)
    if (g !== undefined && drawn.has(g)) return g
    const c = outOf(x, id, 'IN_CLASS')[0]?.dst
    return c !== undefined && collapsedLanes.has(c) ? c : undefined
  }
  const laneMid = new Map(nodes.filter(n => n.type === 'lane' && n.data.node?.kind === 'class').map(n => [n.id, n.position.y + n.height / 2]))
  const agg = new Map<string, LaidOutEdge>()
  for (const e of graph.edges) {
    const tg = toggleOf(e.rel)
    if (tg === null || !v.on.has(tg)) continue
    const a = anchor(e.src), b = anchor(e.dst)
    if (a === undefined || b === undefined || a === b) continue
    // Lane→lane dependencies are the class-level arcs below, drawn whether or not a lane is open.
    if (e.rel === 'DEPENDS_ON' && laneMid.has(a) && laneMid.has(b)) continue
    const id = `${e.rel}:${a}->${b}`
    const prev = agg.get(id)
    agg.set(id, prev === undefined ? { id, source: a, target: b, rel: e.rel, label: e.rel, count: 1 } : { ...prev, count: prev.count + 1 })
  }
  const edges = [...agg.values()].map(e => (e.count > 1 ? { ...e, label: `${e.rel} ×${e.count}` } : e))
  // Class-level DEPENDS_ON arcs between drawn lanes: shorter spans bow less, so
  // the arcs nest on the right of the column instead of merging into one line.
  if (v.on.has('DEPENDS_ON')) {
    const arcs = [...classDeps(x)].flatMap(([a, m]) => [...m].map(([b, count]) => ({ a, b, count })))
      .filter(({ a, b }) => laneMid.has(a) && laneMid.has(b))
      .map(arc => ({ ...arc, span: Math.abs((laneMid.get(arc.a) ?? 0) - (laneMid.get(arc.b) ?? 0)) }))
      .sort((p, q) => p.span - q.span || p.a.localeCompare(q.a) || p.b.localeCompare(q.b))
    arcs.forEach(({ a, b, count }, i) => {
      edges.push({ id: `DEPENDS_ON:${a}->${b}`, source: a, target: b, rel: 'DEPENDS_ON', label: `DEPENDS_ON ×${count}`, count, offset: ARC_BASE + ARC_STEP * i })
    })
  }
  if (v.on.has('CONTRACT')) {
    for (const s of drawnSkills) {
      for (const p of s.requires ?? []) edges.push({ id: `requires:${p}->${s.id}`, source: `pred:${p}`, target: s.id, rel: 'requires', label: 'requires', count: 1 })
      for (const p of s.ensures ?? []) edges.push({ id: `ensures:${s.id}->${p}`, source: s.id, target: `pred:${p}`, rel: 'ensures', label: 'ensures', count: 1 })
    }
  }
  return { nodes, edges }
}

/** A node's absolute position (a lane child's position is relative to its lane). */
export function absolutePosition(nodes: readonly LaidOutNode[], n: LaidOutNode): { x: number; y: number } {
  const p = n.parentId === undefined ? undefined : nodes.find(o => o.id === n.parentId)
  return p === undefined ? n.position : { x: p.position.x + n.position.x, y: p.position.y + n.position.y }
}
