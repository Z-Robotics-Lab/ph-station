/** Custom React Flow node for the mission graph. One component for all four
 * roles (mission / task node / stage / capability); `data.kind` picks the shape
 * and `data.state` the status color. Colors are the established three
 * (green pass / red fail / neutral pending), so the cockpit reads identically to
 * 战报 / 演进 / 账本. */

import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeDatum } from './graphModel.ts'
import css from './ops.module.css'

/** Render one graph node. React Flow supplies `data` and `selected`. */
export function StatusNode({ data, selected }: NodeProps) {
  const d = data as NodeDatum
  const cls = [
    css.node,
    css[`node_${d.kind}`],
    d.state ? css[`state_${d.state}`] : '',
    selected ? css.nodeSelected : '',
  ].filter(Boolean).join(' ')
  return (
    <div className={cls} title={d.sub ?? d.label}>
      <Handle type="target" position={Position.Left} className={css.handle} />
      <div className={css.nodeLabel}>{d.label}</div>
      {d.sub ? <div className={css.nodeSub}>{d.sub}</div> : null}
      {d.privileged ? <span className={css.privBadge}>priv</span> : null}
      <Handle type="source" position={Position.Right} className={css.handle} />
    </div>
  )
}
