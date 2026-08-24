/** The mission cockpit's interactive graph: React Flow over a dagre-laid DAG of
 * mission → task node → stage pipeline plus the capability-wiring fan. Pan/zoom,
 * a minimap, and click-to-select drive the evidence panel. React Flow renders
 * its own DOM subtree, so it does not inherit the panel language automatically —
 * ops.module.css overrides the `--xy-*` variables against `currentColor`, which
 * flips with the app theme, and imports React Flow's base stylesheet. */

import { useMemo } from 'react'
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, type Edge, type NodeMouseHandler,
} from '@xyflow/react'
// ponytail: React Flow's stylesheet is vendored as a relative file, not
// imported as `@xyflow/react/dist/style.css`. The client bundle only injects
// RELATIVE global CSS (bare node_modules CSS from the client entry is not
// resolved by the css-inline plugin); a relative copy is the supported path.
// Refresh it from @xyflow/react/dist/style.css on an xyflow major bump.
import './xyflow.css'
import { StatusNode } from './StatusNode.tsx'
import type { MissionNode, NodeDatum } from './graphModel.ts'
import css from './ops.module.css'

/** Stable node-type registry (defined once so React Flow does not warn). */
const nodeTypes = { status: StatusNode }

/** Minimap tint per node state — the same three status hues as the nodes. */
function miniColor(node: { data?: unknown }): string {
  const d = node.data as NodeDatum | undefined
  if (d?.kind === 'capability') return 'var(--ph-neutral)'
  if (d?.state === 'pass') return 'var(--ph-pass)'
  if (d?.state === 'fail') return 'var(--ph-fail)'
  return 'var(--ph-neutral)'
}

export interface MissionGraphProps {
  nodes: MissionNode[]
  edges: Edge[]
  /** Remount key: changes only on a structural change (run/session switch or a
   * newly sealed stage), so a no-op poll preserves the operator's pan/zoom. */
  graphKey: string
  selectedId: string | null
  onSelect: (id: string) => void
}

/** Render the interactive mission DAG. */
export function MissionGraph({ nodes, edges, graphKey, selectedId, onSelect }: MissionGraphProps) {
  // Self-managed selection (React Flow stays controlled; changes are no-ops).
  const shown = useMemo(
    () => nodes.map(n => ({ ...n, selected: n.id === selectedId })),
    [nodes, selectedId],
  )
  const styledEdges = useMemo<Edge[]>(
    () => edges.map((e) => {
      const wiring = (e.data as { wiring?: boolean } | undefined)?.wiring === true
      // Wiring edges read as dashed + dim; execution edges are solid.
      return wiring ? { ...e, style: { strokeDasharray: '5 4', opacity: 0.65 } } : e
    }),
    [edges],
  )
  const onNodeClick: NodeMouseHandler = (_e, node) => { onSelect(node.id) }

  return (
    <div className={css.graph}>
      <ReactFlow
        key={graphKey}
        nodes={shown}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={() => {}}
        onEdgesChange={() => {}}
        onNodeClick={onNodeClick}
        colorMode="system"
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
        maxZoom={1.75}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
        <MiniMap pannable zoomable nodeColor={miniColor} className={css.minimap} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
