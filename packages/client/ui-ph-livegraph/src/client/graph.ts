/**
 * Pure fold: board payloads → the execution-graph view model. Rendering-state
 * assembly only (which node is running, which stage crossed) — every number and
 * verdict is copied verbatim from the Python board layer, never computed here
 * (charter: TS renders only).
 *
 * Two sources compose one graph:
 * - `session({name})` chain rows — the capability ROUTING network
 *   (`capability.resolve`: consumer → capability → provider ref), static per
 *   task mount, and the sealed `task.plan_complete` fallback when the live feed
 *   is absent (a runtime that pre-dates runtime_events.jsonl).
 * - `runtimeEvents({name, afterSeq})` — the operational feed
 *   (task_claimed / plan_built / node_start / stage_transition / node_verified…)
 *   that animates plan nodes and stages while a task runs.
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

/** One task-plan node (a skill call the workload dispatches). */
export interface PlanNodeState {
  readonly id: string
  readonly skill: string
  readonly args: Record<string, unknown>
  status: NodeStatus
  stages: StageState[]
  steps?: number
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

/** Routing network from the chain: dedupe by capability keeping the LAST
 * resolve (fresh kernel per task — the last mount is the current wiring). */
export function foldRouting(session: unknown): RoutingRow[] {
  const rows = (session as SessionRows)?.rows?.['capability.resolve'] ?? []
  const last = new Map<string, RoutingRow>()
  for (const r of rows) {
    if (r && typeof r.capability === 'string') last.set(r.capability, r)
  }
  return [...last.values()]
}

/** Sealed-chain fallback: the newest task.plan_complete as a static plan. */
function foldSealedPlan(session: unknown, model: LiveGraphModel): void {
  const completes = (session as SessionRows)?.rows?.['task.plan_complete'] ?? []
  const latest = completes[completes.length - 1]
  if (!latest) return
  model.goal = latest.goal ?? null
  model.replans = latest.replans ?? 0
  model.task = { status: 'done' }
  for (const [id, n] of Object.entries(latest.nodes ?? {})) {
    model.planNodes.push({
      id,
      skill: id.replace(/-\d+$/, ''),
      args: {},
      status: n.success ? 'verified' : 'failed',
      stages: (n.stages ?? []).map(s => ({ name: s.name, status: s.success ? 'verified' : 'failed' })),
    })
  }
}

/** Fold the whole event feed (this boot) into the model, oldest first. */
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
  let current: PlanNodeState | undefined
  for (const e of events) {
    switch (e.kind) {
      case 'boot':
        model.boot = { mode: e.mode as string, render: e.render as boolean, pid: e.pid as number }
        break
      case 'task_claimed':
        model.task = { brief: e.brief as string, task: e.task as string,
          seed: e.seed as number, status: 'running' }
        model.goal = null
        model.replans = 0
        model.planNodes = []
        model.verify = []
        current = undefined
        break
      case 'plan_built': {
        model.goal = (e.goal as string) ?? model.goal
        model.replans = (e.replan as number) ?? model.replans
        const prior = new Map(model.planNodes.map(n => [n.id, n]))
        model.planNodes = ((e.nodes as { id: string; skill: string; args?: Record<string, unknown> }[]) ?? [])
          .map(n => prior.get(n.id) ?? ({ id: n.id, skill: n.skill, args: n.args ?? {}, status: 'pending', stages: [] }))
        model.verify = ((e.verify as { after: string; predicate: string }[]) ?? [])
        break
      }
      case 'node_start':
        current = model.planNodes.find(n => n.id === e.node)
        if (current) {
          current.status = 'running'
          current.stages = []
        }
        break
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
        if (current && current.id === e.node) current.status = 'verified'
        break
      case 'node_failed':
        if (current && current.id === e.node) current.status = 'failed'
        break
      case 'replan':
        model.replans = (e.replan as number) ?? model.replans
        for (const n of model.planNodes) if (n.status === 'failed') n.status = 'replanned'
        break
      case 'plan_complete':
        if (model.task) model.task.status = e.success ? 'done' : 'failed'
        break
      case 'task_done':
        if (model.task) model.task.status = 'done'
        break
      case 'task_failed':
        if (model.task) {
          model.task.status = 'failed'
          model.task.error = e.error as string
        }
        break
      default:
        break // merge-extensible feed: an unknown kind is a future event, skipped
    }
  }
  return model
}

/** Whether the model shows an in-flight task (drives the fast poll cadence). */
export function isRunning(model: LiveGraphModel): boolean {
  return model.task?.status === 'running'
}

// --- dagre layout ------------------------------------------------------------

/** Fixed node footprints the layout uses (React Flow measures after mount, but
 * a deterministic layout wants deterministic sizes). */
export const NODE_SIZE = {
  mission: { width: 200, height: 62 },
  plan: { width: 190, height: 84 },
  cap: { width: 168, height: 46 },
} as const

/** A positioned node ready for React Flow. */
export interface LaidOutNode {
  id: string
  type: keyof typeof NODE_SIZE
  position: { x: number; y: number }
  data: Record<string, unknown>
}

/** A typed edge ready for React Flow (`kind` picks the CSS class). */
export interface LaidOutEdge {
  id: string
  source: string
  target: string
  kind: 'routing' | 'plan' | 'verify'
}

/** Two lanes: the mission→plan chain through dagre (rankdir TB, left), the
 * capability-routing grid placed beside it (two columns, no inter-edges to
 * lay out — dagre would flatten the star into one clipped-wide row). */
export function layout(model: LiveGraphModel): { nodes: LaidOutNode[]; edges: LaidOutEdge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 18, ranksep: 38, marginx: 8, marginy: 8 })
  g.setDefaultEdgeLabel(() => ({}))

  const nodes: LaidOutNode[] = []
  const edges: LaidOutEdge[] = []
  const add = (id: string, type: keyof typeof NODE_SIZE, data: Record<string, unknown>) => {
    g.setNode(id, { ...NODE_SIZE[type] })
    nodes.push({ id, type, position: { x: 0, y: 0 }, data })
  }

  add('mission', 'mission', { model })
  let prev = 'mission'
  for (const node of model.planNodes) {
    const id = `plan:${node.id}`
    add(id, 'plan', { node })
    g.setEdge(prev, id)
    edges.push({ id: `plan:${prev}->${id}`, source: prev, target: id, kind: 'plan' })
    prev = id
  }
  for (const v of model.verify) {
    const target = `plan:${v.after}`
    if (nodes.some(n => n.id === target)) {
      edges.push({ id: `verify:${v.predicate}->${v.after}`, source: 'mission', target, kind: 'verify' })
    }
  }

  dagre.layout(g)
  let planRight = 0
  for (const n of nodes) {
    const pos = g.node(n.id)
    n.position = { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 }
    planRight = Math.max(planRight, n.position.x + pos.width)
  }

  const capW = NODE_SIZE.cap.width
  const capH = NODE_SIZE.cap.height
  model.routing.forEach((cap, i) => {
    const id = `cap:${cap.capability}`
    nodes.push({
      id, type: 'cap',
      position: {
        x: planRight + 70 + (i % 2) * (capW + 18),
        y: 8 + Math.floor(i / 2) * (capH + 16),
      },
      data: { cap },
    })
    edges.push({ id: `routing:${cap.capability}`, source: 'mission', target: id, kind: 'routing' })
  })
  return { nodes, edges }
}
