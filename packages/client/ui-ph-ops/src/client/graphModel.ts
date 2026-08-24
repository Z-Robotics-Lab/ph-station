/** Build the mission cockpit's React Flow graph from one sealed task run plus
 * the session's capability-wiring rows, and lay it out with dagre. Pure data
 * shaping + deterministic layout — no rate is recomputed here; node color comes
 * straight from the sealed success flags (format.nodeState). */

import Dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'
import { Position } from '@xyflow/react'
import { nodeState, type NodeState } from './format.ts'
import type { CapabilityResolve, PlanComplete } from './types.ts'

/** The data every custom node carries. `kind` picks the node's shape/role;
 * `state` drives the status color for execute nodes (wiring nodes are neutral). */
export interface NodeDatum extends Record<string, unknown> {
  kind: 'mission' | 'node' | 'stage' | 'capability'
  label: string
  sub?: string | undefined
  state?: NodeState | undefined
  privileged?: boolean | undefined
  /** The raw source row, carried for the evidence panel on click. */
  detail?: unknown
}

export type MissionNode = Node<NodeDatum>

/** Per-kind box size dagre lays out against (matches the StatusNode CSS). */
const SIZE: Record<NodeDatum['kind'], { w: number; h: number }> = {
  mission: { w: 190, h: 60 },
  node: { w: 150, h: 54 },
  stage: { w: 128, h: 46 },
  capability: { w: 176, h: 46 },
}

/**
 * Assemble nodes + edges for one task run. The execution branch is
 * mission → task node(s) → stage pipeline (solid edges, status-colored). The
 * wiring branch is mission → each resolved capability (dashed edges, neutral),
 * with the planner marked privileged when the row says so.
 * @param run - the selected sealed plan_complete row (or null when none).
 * @param wiring - the session's capability.resolve rows.
 * @param goalFallback - goal text when the run carries none.
 */
export function buildGraph(
  run: PlanComplete | null,
  wiring: CapabilityResolve[],
  goalFallback: string,
): { nodes: MissionNode[]; edges: Edge[] } {
  const nodes: MissionNode[] = []
  const edges: Edge[] = []
  const goal = run?.goal ?? goalFallback
  const missionId = 'mission'
  nodes.push({
    id: missionId,
    type: 'status',
    position: { x: 0, y: 0 },
    data: { kind: 'mission', label: goal, state: nodeState(run?.success), detail: run },
  })

  const planNodes = Object.entries(run?.nodes ?? {})
  for (const [nodeName, node] of planNodes) {
    const nodeId = `node:${nodeName}`
    nodes.push({
      id: nodeId,
      type: 'status',
      position: { x: 0, y: 0 },
      data: { kind: 'node', label: nodeName, state: nodeState(node.success), detail: node },
    })
    edges.push({ id: `e:${missionId}-${nodeId}`, source: missionId, target: nodeId })
    // Stages run as a sequential pipeline inside the node.
    let prev = nodeId
    ;(node.stages ?? []).forEach((stage, i) => {
      const stageId = `${nodeId}:stage:${i}`
      nodes.push({
        id: stageId,
        type: 'status',
        position: { x: 0, y: 0 },
        data: {
          kind: 'stage',
          label: stage.name ?? `stage ${i + 1}`,
          state: nodeState(stage.success),
          detail: stage,
        },
      })
      edges.push({ id: `e:${prev}-${stageId}`, source: prev, target: stageId })
      prev = stageId
    })
  }

  // Wiring branch: one dashed edge per resolved capability off the mission.
  for (const cap of wiring) {
    if (!cap.capability) continue
    const capId = `cap:${cap.capability}`
    if (nodes.some(n => n.id === capId)) continue
    nodes.push({
      id: capId,
      type: 'status',
      position: { x: 0, y: 0 },
      data: {
        kind: 'capability',
        label: cap.capability,
        sub: cap.ref ?? undefined,
        privileged: cap.privileged === true,
        detail: cap,
      },
    })
    edges.push({
      id: `e:${missionId}-${capId}`,
      source: missionId,
      target: capId,
      data: { wiring: true },
    })
  }

  return layout(nodes, edges)
}

/** Left-to-right layered layout via dagre; writes x/y + handle positions back. */
function layout(nodes: MissionNode[], edges: Edge[]): { nodes: MissionNode[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 18, ranksep: 64, marginx: 8, marginy: 8 })
  for (const n of nodes) {
    const size = SIZE[n.data.kind]
    g.setNode(n.id, { width: size.w, height: size.h })
  }
  for (const e of edges) g.setEdge(e.source, e.target)
  Dagre.layout(g)
  const placed = nodes.map((n) => {
    const size = SIZE[n.data.kind]
    const p = g.node(n.id)
    // dagre centers nodes; React Flow positions by top-left corner.
    return {
      ...n,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: { x: p.x - size.w / 2, y: p.y - size.h / 2 },
    }
  })
  return { nodes: placed, edges }
}
