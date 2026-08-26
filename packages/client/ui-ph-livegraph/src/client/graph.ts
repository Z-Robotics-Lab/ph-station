/**
 * Pure fold: board payloads → the merged execution-graph view model. Rendering-
 * state assembly only (which attempt ran, which stage crossed, which run is
 * selected) — every number and verdict is copied verbatim from the Python board
 * layer, never computed here (charter: TS renders only).
 *
 * One canvas, three composable layers:
 * - PLAN: mission → plan-node attempts → per-node stage pipeline. Source is the
 *   live `plan_built` feed, or the newest sealed `task.plan_complete` when the
 *   feed is absent (a runtime that pre-dates runtime_events.jsonl).
 * - ROUTING: capability fan (`capability.resolve`: consumer → capability →
 *   provider ref), static per task mount, collapsible.
 * - LIVE: node/stage state + replan lineage animated from the ordered feed.
 *
 * Replay is feed truncation: `foldEvents(rows, feed.filter(e => e.seq <= K))`
 * folds any prefix, so a scrubber playhead at seq K renders that mid-run state.
 * `foldRuns` splits the same feed into `task_claimed → task_done` runs for the
 * run selector and the scrubber's seq range.
 */

import dagre from '@dagrejs/dagre'

/** One operational event line (harness.opstream shape, fields per kind). */
export interface OpEvent {
  readonly ts?: number
  readonly seq: number
  readonly kind: string
  readonly [key: string]: unknown
}

/** Node/stage lifecycle states, colored per the PH status vocabulary. */
export type NodeStatus = 'pending' | 'running' | 'verified' | 'failed' | 'replanned'

/** One per-node stage chip. */
export interface StageState {
  readonly name: string
  readonly status: NodeStatus
}

/** One plan-node ATTEMPT (a skill call the workload dispatched). A single
 * logical node id gains a fresh attempt each replan, so the failed tries stay
 * on the canvas as replan lineage instead of being overwritten. */
export interface PlanNodeState {
  /** Logical node id, stable across attempts (e.g. `stack-0`). */
  readonly id: string
  /** Unique per-attempt key for React Flow (e.g. `stack-0#1`). */
  readonly key: string
  /** 0-based attempt index (the replan generation that ran). */
  readonly attempt: number
  readonly skill: string
  readonly args: Record<string, unknown>
  status: NodeStatus
  stages: StageState[]
  steps?: number
  /** Node duration ms (node_start → terminal event), when both are seen. */
  ms?: number
  /** Failed stages/predicates from `node_failed` (the fault detail). */
  faults?: string[]
}

/** One capability-routing row (consumer resolved capability through ref). */
export interface RoutingRow {
  readonly capability: string
  readonly consumer: string
  readonly ref: string
  readonly privileged: boolean
}

/** The folded view model the panel renders. */
export interface LiveGraphModel {
  /** Live feed reachability: false renders the sealed-chain fallback banner. */
  live: boolean
  boot: { mode?: string; render?: boolean; pid?: number } | null
  task: {
    brief?: string
    task?: string
    seed?: number
    status: 'running' | 'done' | 'failed'
    error?: string
  } | null
  goal: string | null
  replans: number
  planNodes: PlanNodeState[]
  verify: { after: string; predicate: string }[]
  routing: RoutingRow[]
}

/** One past run the selector offers (a `task_claimed → task_done` span). */
export interface RunInfo {
  readonly index: number
  readonly seed?: number
  readonly task?: string
  readonly brief?: string
  readonly firstSeq: number
  lastSeq: number
  status: 'running' | 'done' | 'failed'
  success?: boolean
  replans: number
  /** Key-event seqs the scrubber marks as ticks. */
  markers: { seq: number; kind: string }[]
}

/** Session-row payload subset the fold reads. */
interface SessionRows {
  rows?: {
    'capability.resolve'?: RoutingRow[]
    'task.plan_complete'?: {
      success?: boolean
      goal?: string
      replans?: number
      nodes?: Record<string, { success?: boolean; stages?: { name: string; success: boolean }[] }>
    }[]
  }
}

/**
 * Routing network from the chain: dedupe by capability keeping the LAST
 * resolve (fresh kernel per task — the last mount is the current wiring).
 * @param session - the board session payload; anything without `rows` folds to empty.
 * @returns one row per capability, in last-resolve order.
 */
export function foldRouting(session: unknown): RoutingRow[] {
  const rows = (session as SessionRows)?.rows?.['capability.resolve'] ?? []
  const last = new Map<string, RoutingRow>()
  for (const r of rows) {
    if (r && typeof r.capability === 'string') last.set(r.capability, r)
  }
  return [...last.values()]
}

/**
 * Split the feed into runs for the selector + scrubber range. Boundaries are
 * `task_claimed` (open) → `task_done`/`task_failed` (close); the trailing run
 * stays open (running) when the feed ends mid-task.
 * @param events - the operational feed, oldest first.
 * @returns one RunInfo per task_claimed, in feed order.
 */
export function foldRuns(events: readonly OpEvent[]): RunInfo[] {
  const runs: RunInfo[] = []
  let cur: RunInfo | undefined
  const mark = new Set(['plan_built', 'node_start', 'node_verified', 'node_failed', 'replan', 'plan_complete'])
  for (const e of events) {
    if (e.kind === 'task_claimed') {
      cur = {
        index: runs.length, seed: e.seed as number, task: e.task as string, brief: e.brief as string,
        firstSeq: e.seq, lastSeq: e.seq, status: 'running', replans: 0, markers: [],
      }
      runs.push(cur)
      continue
    }
    if (!cur) continue
    cur.lastSeq = e.seq
    if (mark.has(e.kind)) cur.markers.push({ seq: e.seq, kind: e.kind })
    switch (e.kind) {
      case 'plan_built': cur.replans = (e.replan as number) ?? cur.replans; break
      case 'plan_complete': cur.success = e.success as boolean; break
      case 'task_done': cur.status = cur.success === false ? 'failed' : 'done'; break
      case 'task_failed': cur.status = 'failed'; break
      default: break
    }
  }
  return runs
}

/** Sealed-chain fallback: the newest task.plan_complete as a static plan. */
function foldSealedPlan(session: unknown, model: LiveGraphModel): void {
  const completes = (session as SessionRows)?.rows?.['task.plan_complete'] ?? []
  const latest = completes[completes.length - 1]
  if (!latest) return
  model.goal = latest.goal ?? null
  model.replans = latest.replans ?? 0
  model.task = { status: latest.success ? 'done' : 'failed' }
  for (const [id, n] of Object.entries(latest.nodes ?? {})) {
    model.planNodes.push({
      id, key: `${id}#0`, attempt: 0,
      skill: id.replace(/-\d+$/, ''),
      args: {},
      status: n.success ? 'verified' : 'failed',
      stages: (n.stages ?? []).map(s => ({ name: s.name, status: s.success ? 'verified' : 'failed' })),
    })
  }
}

/**
 * Fold the whole event feed into the model, oldest first (or a `seq ≤ K`
 * prefix for replay). Resets at each `task_claimed`, so the result is the state
 * of whichever run the last event belongs to.
 * @param session - the board session payload feeding the routing layer and the sealed-plan fallback.
 * @param events - the operational feed, oldest first; empty means not live.
 * @returns the complete render model for one run.
 */
export function foldEvents(session: unknown, events: readonly OpEvent[]): LiveGraphModel {
  const model: LiveGraphModel = {
    live: events.length > 0,
    boot: null,
    task: null,
    goal: null,
    replans: 0,
    planNodes: [],
    verify: [],
    routing: foldRouting(session),
  }
  if (events.length === 0) {
    foldSealedPlan(session, model)
    return model
  }
  // Attempt bookkeeping: every logical id maps to its ordered list of attempts;
  // a replan retry (node_start on a terminal-failed id) forks a fresh attempt.
  let attempts = new Map<string, PlanNodeState[]>()
  const defs = new Map<string, { skill: string; args: Record<string, unknown> }>()
  let current: PlanNodeState | undefined
  let currentStart = 0

  const reset = () => {
    model.goal = null; model.replans = 0; model.planNodes = []; model.verify = []
    attempts = new Map(); defs.clear(); current = undefined
  }

  for (const e of events) {
    switch (e.kind) {
      case 'boot':
        model.boot = { mode: e.mode as string, render: e.render as boolean, pid: e.pid as number }
        break
      case 'task_claimed':
        model.task = { brief: e.brief as string, task: e.task as string, seed: e.seed as number, status: 'running' }
        reset()
        break
      case 'plan_built': {
        model.goal = (e.goal as string) ?? model.goal
        model.replans = (e.replan as number) ?? model.replans
        for (const def of (e.nodes as { id: string; skill: string; args?: Record<string, unknown> }[]) ?? []) {
          defs.set(def.id, { skill: def.skill, args: def.args ?? {} })
          if (!attempts.has(def.id)) {
            const node: PlanNodeState = {
              id: def.id, key: `${def.id}#0`, attempt: 0, skill: def.skill,
              args: def.args ?? {}, status: 'pending', stages: [],
            }
            attempts.set(def.id, [node]); model.planNodes.push(node)
          }
        }
        model.verify = (e.verify as { after: string; predicate: string }[]) ?? []
        break
      }
      case 'node_start': {
        const id = e.node as string
        const def = defs.get(id) ?? { skill: (e.skill as string) ?? id, args: {} }
        const list = attempts.get(id) ?? []
        const last = list[list.length - 1]
        if (last && (last.status === 'failed' || last.status === 'replanned')) {
          const node: PlanNodeState = {
            id, key: `${id}#${list.length}`, attempt: list.length, skill: def.skill,
            args: def.args, status: 'running', stages: [],
          }
          list.push(node); attempts.set(id, list); model.planNodes.push(node)
          current = node
        } else if (last && last.status === 'pending') {
          last.status = 'running'; last.stages = []; current = last
        } else {
          const node: PlanNodeState = {
            id, key: `${id}#0`, attempt: 0, skill: def.skill, args: def.args, status: 'running', stages: [],
          }
          attempts.set(id, [node]); model.planNodes.push(node); current = node
        }
        currentStart = e.ts ?? 0
        break
      }
      case 'stage_transition':
        if (current) {
          current.stages = [...current.stages,
            { name: e.stage as string, status: e.success ? 'verified' : 'failed' }]
        }
        break
      case 'actuation_end':
        if (current) current.steps = e.steps as number
        break
      case 'node_verified':
        if (current && current.id === e.node) {
          current.status = 'verified'
          if (e.ts && currentStart) current.ms = (e.ts - currentStart) * 1000
        }
        break
      case 'node_failed':
        if (current && current.id === e.node) {
          current.status = 'failed'
          current.faults = (e.failed as string[]) ?? undefined
          if (e.ts && currentStart) current.ms = (e.ts - currentStart) * 1000
        }
        break
      case 'replan':
        model.replans = (e.replan as number) ?? model.replans
        break
      case 'plan_complete':
        if (model.task) model.task.status = e.success ? 'done' : 'failed'
        break
      case 'task_done':
        if (model.task) model.task.status = 'done'
        break
      case 'task_failed':
        if (model.task) { model.task.status = 'failed'; model.task.error = e.error as string }
        break
      default:
        break // merge-extensible feed: an unknown kind is a future event, skipped
    }
  }
  // Superseded failures (any failed attempt that a later attempt followed) read
  // as amber 'replanned'; only each id's final attempt keeps its true verdict.
  for (const list of attempts.values()) {
    list.slice(0, -1).forEach((n) => { if (n.status === 'failed') n.status = 'replanned' })
  }
  return model
}

/**
 * Whether the model shows an in-flight task (drives the fast poll cadence).
 * @param model - the folded render model.
 * @returns true while the model's task status is `running`.
 */
export function isRunning(model: LiveGraphModel): boolean {
  return model.task?.status === 'running'
}

// --- dagre layout ------------------------------------------------------------

/** Node footprints the layout uses. Width is fixed per type; height is a base
 * used for mission/cap and as the plan fallback — a plan card's real height is
 * derived per node by `planCardHeight` from its content, because the layout
 * (dagre ranks, serpentine row pitch, edge anchors) must reserve the height the
 * NEAR-LOD card actually renders. React Flow measures after mount, but a
 * deterministic, LOD-stable layout wants deterministic sizes, so we estimate. */
export const NODE_SIZE = {
  mission: { width: 212, height: 78 },
  plan: { width: 198, height: 104 },
  cap: { width: 172, height: 48 },
} as const

/**
 * Rendered height of a plan card at NEAR LOD (the tallest band — cards only
 * shrink zooming out, and positions must stay put across LOD). Estimated from
 * the same content `PlanNode` draws: a title row, one wrapped stage-chip block
 * (or a single sub line when there are no stages), and a meta row when any of
 * steps/duration/faults/predicate is present. Deliberately runs a touch high so
 * the box always encloses the card — a short overshoot only adds slack below the
 * content; an undershoot overlaps the next row and floats the edge anchors.
 * @param n - the plan node whose stage/meta content drives its height.
 * @param hasPredicate - whether a verify predicate chip renders in the meta row.
 * @returns the card height in px for the layout footprint.
 */
function planCardHeight(n: PlanNodeState, hasPredicate: boolean): number {
  const stageLines = n.stages.length > 0 ? Math.ceil(n.stages.length / 3) : 1
  const metaItems = (n.steps !== undefined ? 1 : 0) + (n.ms !== undefined ? 1 : 0)
    + (n.faults?.length ? 1 : 0) + (hasPredicate ? 1 : 0)
  const metaLines = metaItems > 0 ? Math.ceil(metaItems / 2) : 0
  return 16 /* padding */ + 22 /* title */
    + stageLines * 20 + (n.stages.length > 0 ? 6 : 4) /* stage chips or sub line */
    + metaLines * 18 + (metaLines > 0 ? 4 : 0) /* meta row(s) */
}

/** A positioned node ready for React Flow, carrying its final footprint (`w`/`h`)
 * so the renderer forces the wrapper to the box the layout reserved and every
 * edge anchor sits on the real card edge. */
export interface LaidOutNode {
  id: string
  type: keyof typeof NODE_SIZE
  position: { x: number; y: number }
  w: number
  h: number
  data: Record<string, unknown>
}

/** A typed edge ready for React Flow. `kind` picks the CSS class; the handle ids
 * are chosen from the two nodes' final geometry (`edgeHandles`) so an edge leaves
 * and enters the ends that face each other after a serpentine wrap flips a row;
 * `active` traces the executing path. */
export interface LaidOutEdge {
  id: string
  source: string
  target: string
  kind: 'routing' | 'plan' | 'branch'
  sourceHandle: string
  targetHandle: string
  active?: boolean
  label?: string
}

/** Side-anchored handle ids every node exposes so an edge can attach to the end
 * that faces its neighbor. Plan cards carry all six (a serpentine wrap row runs
 * right-to-left, so left and right each serve as both source and target); the
 * mission sources right+bottom, a cap targets left. */
export const HANDLE = {
  rightSrc: 'rs', leftSrc: 'ls', bottomSrc: 'b',
  leftTgt: 'lt', rightTgt: 'rt', topTgt: 't',
} as const

/** Source/target handle sides from the two nodes' final centers: same row exits
 * toward the neighbor (right→left forward, left→right on a flipped wrap row); a
 * lower target drops through the row gutter (bottom→top). Keeps every edge off
 * the intervening card faces once the boustrophedon reflow reverses a row. */
function edgeHandles(s: LaidOutNode, t: LaidOutNode): Pick<LaidOutEdge, 'sourceHandle' | 'targetHandle'> {
  const sx = s.position.x + s.w / 2
  const sy = s.position.y + s.h / 2
  const tx = t.position.x + t.w / 2
  const ty = t.position.y + t.h / 2
  // A wrap/next-row edge drops far enough that it clears both cards' half-heights;
  // top-aligned same-row neighbors differ only by (h−h)/2 < this, so they anchor
  // on facing sides instead. Threshold rides the taller card so it scales with h.
  if (ty - sy > Math.max(s.h, t.h) * 0.6) return { sourceHandle: HANDLE.bottomSrc, targetHandle: HANDLE.topTgt }
  return tx >= sx
    ? { sourceHandle: HANDLE.rightSrc, targetHandle: HANDLE.leftTgt }
    : { sourceHandle: HANDLE.leftSrc, targetHandle: HANDLE.rightTgt }
}

/** Serpentine (boustrophedon) reflow of the plan chain into rows that fit
 * `wrapWidth`: dagre lays the chain out as one LR row (2600px for 11 nodes),
 * which a narrow pane can only show by shrinking to the fit floor and panning
 * the tail off-screen. Reflowing the rank-ordered nodes into rows of `perRow`,
 * alternating direction each row so a row's end sits directly above the next
 * row's start, keeps inter-row edges short and lets a wide chain read at ~1:1
 * zoom in a small pane. Mission heads its own leading row; the routing fan (laid
 * out separately below) reads `planBottom` after the reflow.
 *
 * Called only when `wrapWidth` is known and the single dagre row overflows it;
 * a wide pane keeps the flat row (perRow grows to hold every node).
 */
function serpentine(
  nodes: LaidOutNode[],
  wrapWidth: number,
): number {
  const nodeW = NODE_SIZE.plan.width
  const gap = 24
  // Row gutter wide enough that a wrap edge dropping bottom→top reads as its own
  // lane between rows instead of grazing the cards above and below.
  const rowGap = 56
  const marginX = 8
  const plan = nodes.filter(n => n.type === 'plan').sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
  const perRow = Math.max(2, Math.floor((wrapWidth - marginX) / (nodeW + gap)))
  // Mission heads the grid; the chain starts on the row beneath it.
  const mission = nodes.find(n => n.id === 'mission')
  const y0 = (mission ? mission.h : 0) + rowGap
  if (mission) mission.position = { x: marginX, y: 0 }
  // Each row's top is the previous row's top plus that row's TALLEST card (a
  // failed/multi-stage card is taller than its neighbors), so no row bleeds into
  // the next. A uniform pitch off the base height overlapped exactly those rows.
  const rowTop: number[] = []
  let acc = y0
  plan.forEach((n, i) => {
    const row = Math.floor(i / perRow)
    if (i % perRow === 0) rowTop[row] = acc // row opens at the previous row's bottom
    const top = rowTop[row] ?? y0
    acc = Math.max(acc, top + n.h + rowGap) // next row's top: tallest card in this row + gutter
    const col = row % 2 === 0 ? i % perRow : perRow - 1 - (i % perRow)
    n.position = { x: marginX + col * (nodeW + gap), y: top }
  })
  return acc - rowGap
}

/**
 * Lay the plan chain + replan lineage through dagre (rankdir LR — the plan
 * spans the wide axis of a 16:9 panel; nodes carry left/right handles to match),
 * then place the capability-routing fan beside it (two columns; dagre would
 * flatten the star into one clipped-wide row).
 * @param model - the folded render model to lay out.
 * @param showRouting - gates the capability-routing layer.
 * @param wrapWidth - the live pane width; folds an over-wide single row into a
 * serpentine grid that fits it. Omitted or wide enough, the chain stays flat.
 * @returns positioned React Flow nodes and edges.
 */
export function layout(
  model: LiveGraphModel,
  showRouting: boolean,
  wrapWidth?: number,
): { nodes: LaidOutNode[]; edges: LaidOutEdge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 20, ranksep: 60, marginx: 8, marginy: 8 })
  g.setDefaultEdgeLabel(() => ({}))

  const nodes: LaidOutNode[] = []
  const edges: LaidOutEdge[] = []
  const add = (id: string, type: keyof typeof NODE_SIZE, data: Record<string, unknown>) => {
    const w = NODE_SIZE[type].width
    // Plan cards size to their content (near-LOD height); mission/cap are fixed.
    const h = type === 'plan'
      ? planCardHeight((data.node as PlanNodeState), data.predicate !== undefined)
      : NODE_SIZE[type].height
    g.setNode(id, { width: w, height: h })
    nodes.push({ id, type, position: { x: 0, y: 0 }, w, h, data })
  }
  const runningKey = model.planNodes.find(n => n.status === 'running')?.key

  add('mission', 'mission', { model })

  // Group attempts by id in first-appearance order; chain ids, fork lineage.
  const groups: PlanNodeState[][] = []
  const byId = new Map<string, PlanNodeState[]>()
  for (const n of model.planNodes) {
    let list = byId.get(n.id)
    if (!list) { list = []; byId.set(n.id, list); groups.push(list) }
    list.push(n)
    const predicate = model.verify.find(v => v.after === n.id)?.predicate
    add(`plan:${n.key}`, 'plan', { node: n, predicate })
  }
  const edge = (source: string, target: string, kind: LaidOutEdge['kind'], label?: string) => {
    g.setEdge(source, target)
    const e: LaidOutEdge = {
      id: `${kind}:${source}->${target}`, source, target, kind,
      // Placeholder anchors; the post-layout pass sets them from final geometry.
      sourceHandle: HANDLE.rightSrc, targetHandle: HANDLE.leftTgt,
      active: `plan:${runningKey}` === target,
    }
    if (label !== undefined) e.label = label
    edges.push(e)
  }
  let prevTail = 'mission'
  for (const list of groups) {
    let prevInGroup: string | null = null
    for (const n of list) {
      const target = `plan:${n.key}`
      if (prevInGroup === null) edge(prevTail, target, 'plan')
      else edge(prevInGroup, target, 'branch', `replan #${n.attempt}`)
      prevInGroup = target
    }
    if (prevInGroup !== null) prevTail = prevInGroup
  }

  dagre.layout(g)
  let planLeft = 0
  let planBottom = 0
  let planRight = 0
  for (const n of nodes) {
    const pos = g.node(n.id)
    n.position = { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 }
    if (n.id === 'mission') planLeft = n.position.x
    planBottom = Math.max(planBottom, n.position.y + pos.height)
    planRight = Math.max(planRight, n.position.x + pos.width)
  }
  // Fold an over-wide flat row into a serpentine grid that fits the pane. A wide
  // pane (perRow ≥ node count) leaves the row flat, so this is a no-op there.
  if (wrapWidth !== undefined && planRight - planLeft > wrapWidth) {
    planLeft = 8
    planBottom = serpentine(nodes, wrapWidth)
  }

  // Re-anchor every plan/branch edge from the final node centers (post-reflow):
  // a flipped wrap row now exits its correct end and wraps drop through the
  // gutter, so no edge crosses an intervening card. Routing edges are added
  // below with their own fixed anchors.
  const nodeById = new Map(nodes.map(n => [n.id, n]))
  for (const e of edges) {
    const s = nodeById.get(e.source)
    const t = nodeById.get(e.target)
    if (s && t) Object.assign(e, edgeHandles(s, t))
  }

  if (showRouting) {
    // Under LR the plan chain runs the wide axis, so the routing fan docks BELOW
    // it (three columns from the left edge) — leaving mission's bottom handle it
    // stays near its anchor instead of spanning the full plan width.
    const capW = NODE_SIZE.cap.width
    const capH = NODE_SIZE.cap.height
    model.routing.forEach((cap, i) => {
      const id = `cap:${cap.capability}`
      nodes.push({
        id, type: 'cap', w: capW, h: capH,
        position: { x: planLeft + (i % 3) * (capW + 20), y: planBottom + 44 + Math.floor(i / 3) * (capH + 18) },
        data: { cap },
      })
      edges.push({
        id: `routing:${cap.capability}`, source: 'mission', target: id, kind: 'routing',
        sourceHandle: HANDLE.bottomSrc, targetHandle: HANDLE.leftTgt,
      })
    })
  }
  return { nodes, edges }
}
