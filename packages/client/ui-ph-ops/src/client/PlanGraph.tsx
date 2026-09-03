/** One seed's plan as a small SVG graph: dagre (LR) ranks the nodes by their
 * `after` edges — plan order chained when no entry carries `after` — and each
 * node is a rounded rect with the id, a skill/kind glyph, and a state colour:
 * ✓ pass (green), ✗ fail (red, failure_mode under it), ● running (amber,
 * pulsing — the first `ok: null` while `running`), ○ queued (grey); recovery
 * kinds dashed. With `other` (the paired baseline / trial rows), a node whose
 * `ok` differs there gets the thicker amber outline. Steps / failure mode sit
 * in the node's <title> tooltip. Pure render: no state, no effects. */

import dagre from '@dagrejs/dagre'
import type { NodeRow } from './types.ts'
import css from './ops.module.css'

const W = 96
const H = 30
/** Layout box height: the rect plus room for the failure_mode line under it. */
const BOX = H + 14

type NodeState = 'pass' | 'fail' | 'running' | 'queued'

/** State per node in plan order; the first unrun node is `running` only while `running`. */
function nodeStates(nodes: NodeRow[], running: boolean): NodeState[] {
  let next = running
  return nodes.map((nd) => {
    if (nd.ok === true) return 'pass'
    if (nd.ok === false) return 'fail'
    if (next) { next = false; return 'running' }
    return 'queued'
  })
}

export function PlanGraph({ nodes, other, running = false, testId, stepsLabel }: {
  nodes: NodeRow[]
  other?: NodeRow[] | undefined
  running?: boolean
  testId?: string
  /** `n → "n steps"`, the locale's `rsi.node.steps`. */
  stepsLabel: (n: number) => string
}) {
  const ids = nodes.map((nd, i) => nd.id ?? `#${i}`)
  const explicit = nodes.some(nd => (nd.after?.length ?? 0) > 0)
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 8, ranksep: 26, marginx: 4, marginy: 2 })
  g.setDefaultEdgeLabel(() => ({}))
  ids.forEach(id => g.setNode(id, { width: W, height: BOX }))
  const edges: Array<[string, string]> = []
  ids.forEach((id, i) => {
    const after = explicit ? (nodes[i]?.after ?? []).filter(a => ids.includes(a)) : i > 0 ? [ids[i - 1] as string] : []
    for (const a of after) { g.setEdge(a, id); edges.push([a, id]) }
  })
  dagre.layout(g)
  const { width = 0, height = 0 } = g.graph()
  const states = nodeStates(nodes, running)
  return (
    <div className={css.planGraph} data-testid={testId}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={css.planSvg}>
        <defs>
          <marker id="pg-arrow" viewBox="0 0 6 6" refX="6" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0L6 3L0 6z" fill="currentColor" />
          </marker>
        </defs>
        {edges.map(([a, b]) => (
          <polyline key={`${a}>${b}`} data-edge={explicit ? 'after' : 'order'} className={css.planEdge}
            points={(g.edge(a, b).points).map(p => `${p.x},${p.y}`).join(' ')} markerEnd="url(#pg-arrow)" />
        ))}
        {nodes.map((nd, i) => {
          const id = ids[i] as string
          const { x, y } = g.node(id)
          const state = states[i]
          const o = other?.find(x => x.id === nd.id)
          const changed = other !== undefined && (nd.ok ?? null) !== (o?.ok ?? null)
          const hint = [state === 'pass' ? '✓' : state === 'fail' ? '✗' : '', typeof nd.steps === 'number' ? stepsLabel(nd.steps) : '', nd.failure_mode ?? '']
            .filter(Boolean).join(' · ')
          const glyph = [nd.kind === 'recovery' ? '↺' : '', nd.skill ?? nd.kind ?? ''].filter(Boolean).join(' ')
          return (
            <g key={id} data-node={id} data-state={state} data-kind={nd.kind ?? undefined} data-changed={changed ? 'true' : undefined}
              className={css.planNode} transform={`translate(${x - W / 2},${y - BOX / 2})`}>
              <title>{hint || id}</title>
              <rect width={W} height={H} rx="6" />
              <text x={6} y={12} className={css.planId}>{id}</text>
              {glyph !== '' && <text x={6} y={24} className={css.planGlyph}>{glyph}</text>}
              {state === 'fail' && nd.failure_mode && <text x={W / 2} y={H + 11} textAnchor="middle" className={css.planFail}>{nd.failure_mode}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
