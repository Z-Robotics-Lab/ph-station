/**
 * draw.io-style manual editing for the execution graph: node positions and
 * per-edge waypoints the operator sets by dragging, pinned over the auto-layout
 * and persisted per graph so they survive polls, LOD changes, pane resizes, and
 * reload. Auto-layout is only the first suggestion — any manual position or bend
 * overrides it until the operator hits re-layout.
 *
 * The same module twins into ui-ph-vault under the panel-independence
 * convention (each panel owns its copy; no shared provider across the boundary).
 */

import { useContext, useMemo, useRef, useState, createContext } from 'react'
import {
  BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, useStore,
  type EdgeProps, type Position,
} from '@xyflow/react'

/** A point in flow coordinates. */
export interface Point { x: number; y: number }

/** The operator's manual overrides for one graph: node id → pinned position,
 * edge id → ordered waypoints the edge routes through. */
export interface ManualState {
  nodes: Record<string, Point>
  edges: Record<string, Point[]>
}

/** Empty overrides (nothing pinned). */
export const EMPTY_MANUAL: ManualState = { nodes: {}, edges: {} }

const key = (surface: string, graph: string) => `ph:${surface}:manual:${graph}`

/** Load the saved overrides for `graph` on `surface`; empty when none/unparsable
 * (a fresh graph shape gets clean auto-layout). Private-mode reads fail to empty. */
export function loadManual(surface: string, graph: string): ManualState {
  try {
    const raw = localStorage.getItem(key(surface, graph))
    if (!raw) return EMPTY_MANUAL
    const p = JSON.parse(raw) as Partial<ManualState>
    return { nodes: p.nodes ?? {}, edges: p.edges ?? {} }
  } catch { return EMPTY_MANUAL }
}

/** Persist overrides for `graph`; a no-op if storage is unavailable. */
export function saveManual(surface: string, graph: string, s: ManualState): void {
  try { localStorage.setItem(key(surface, graph), JSON.stringify(s)) } catch { /* private mode: session-only */ }
}

/** Whether any override is set (drives the re-layout button's enabled state). */
export function hasManual(s: ManualState): boolean {
  return Object.keys(s.nodes).length > 0 || Object.values(s.edges).some(w => w.length > 0)
}

/** Live waypoint writer the editable edge calls; the panel owns the state and
 * persists it. A React context so the custom edge, which React Flow renders, can
 * reach the panel without threading callbacks through the edge object. `persist`
 * marks a settled change (drag release / removal) that should reach storage; a
 * mid-drag update passes it false so only the final position writes. */
interface EditCtx { setWaypoints: (edgeId: string, wps: Point[], persist: boolean) => void }
const Ctx = createContext<EditCtx>({ setWaypoints: () => {} })
export const EditProvider = Ctx.Provider

/** Straight-segment SVG path S → waypoints → T (the drawio bent-edge form). */
function polyPath(s: Point, wps: Point[], t: Point): string {
  return [s, ...wps, t].map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')
}

/** Squared distance from point `p` to segment `a`–`b`; picks which segment of the
 * routed polyline a grab lands on, so an inserted waypoint splits the right one. */
function distToSeg(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  const cx = a.x + t * dx, cy = a.y + t * dy
  return (p.x - cx) ** 2 + (p.y - cy) ** 2
}

/**
 * The editable edge. Routes through `data.waypoints` when set (straight bends),
 * else the default gutter smoothstep from the anchored handles. On hover or
 * selection it shows drag dots: a waypoint dot drags to reroute and
 * double-clicks to remove; a fainter segment-midpoint dot drags out a new bend.
 * Its `label` rides a themed chip, hidden at far zoom.
 */
export function EditableEdge(props: EdgeProps): React.ReactElement {
  const {
    id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    markerEnd, style, selected, data,
  } = props
  const rf = useReactFlow()
  const { setWaypoints } = useContext(Ctx)
  const zoom = useStore(s => s.transform[2])
  const [hover, setHover] = useState(false)
  const dragging = useRef(false)

  const wps = (data?.waypoints as Point[] | undefined) ?? []
  const label = data?.label as string | undefined
  const source: Point = { x: sourceX, y: sourceY }
  const target: Point = { x: targetX, y: targetY }
  const pts = useMemo(() => [source, ...wps, target], [sourceX, sourceY, targetX, targetY, wps])

  let path: string
  let labelX: number
  let labelY: number
  if (wps.length > 0) {
    path = polyPath(source, wps, target)
    const mid = pts[Math.floor(pts.length / 2)] ?? target
    labelX = mid.x; labelY = mid.y
  } else {
    const [p, lx, ly] = getSmoothStepPath({
      sourceX, sourceY, sourcePosition: sourcePosition as Position,
      targetX, targetY, targetPosition: targetPosition as Position, borderRadius: 8,
    })
    path = p; labelX = lx; labelY = ly
  }

  // Drag an existing waypoint at `index` to reroute it.
  const startDrag = (index: number) => (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault()
    dragging.current = true
    let next = wps.slice()
    const move = (ev: PointerEvent) => {
      const p = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
      next = next.slice(); next[index] = { x: Math.round(p.x), y: Math.round(p.y) }
      setWaypoints(id, next, false)
    }
    const up = () => {
      dragging.current = false
      setWaypoints(id, next, true)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Grab anywhere on the line and pull to bend it (drawio semantics): past a
  // small threshold a fresh waypoint is inserted into the nearest segment and
  // dragged; a click that never moves inserts nothing, leaving selection intact.
  const grab = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const startX = e.clientX, startY = e.clientY
    let index = 0
    let seeded = false
    let next = wps.slice()
    const move = (ev: PointerEvent) => {
      if (!seeded) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return
        seeded = true
        dragging.current = true
        const p0 = rf.screenToFlowPosition({ x: startX, y: startY })
        let best = 0, bestD = Infinity
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1]
          if (a === undefined || b === undefined) continue
          const d = distToSeg(p0, a, b); if (d < bestD) { bestD = d; best = i }
        }
        index = best
        next.splice(index, 0, { x: Math.round(p0.x), y: Math.round(p0.y) })
      }
      const p = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
      next = next.slice(); next[index] = { x: Math.round(p.x), y: Math.round(p.y) }
      setWaypoints(id, next, false)
    }
    const up = () => {
      if (seeded) setWaypoints(id, next, true)
      dragging.current = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const removeWp = (index: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = wps.slice(); next.splice(index, 1); setWaypoints(id, next, true)
  }

  const show = selected === true || hover

  return (
    <g onPointerEnter={() => { if (!dragging.current) setHover(true) }} onPointerLeave={() => { if (!dragging.current) setHover(false) }}>
      <BaseEdge
        id={id} path={path} interactionWidth={0}
        {...(markerEnd !== undefined ? { markerEnd } : {})}
        {...(style !== undefined ? { style } : {})}
      />
      {/* Wide invisible grab band over the whole edge: hover reveals dots, drag bends. */}
      <path
        d={path} fill="none" stroke="transparent" strokeWidth={18}
        style={{ cursor: 'grab' }} onPointerDown={grab}
      />
      {show ? wps.map((w, i) => (
        <circle
          key={`wp-${i}`} cx={w.x} cy={w.y} r={5.5}
          className="ph-edge-wp" style={{ cursor: 'grab' }}
          onPointerDown={startDrag(i)} onDoubleClick={removeWp(i)}
        />
      )) : null}
      {label !== undefined && zoom >= 0.55 ? (
        <EdgeLabelRenderer>
          <div
            className="ph-edge-chip"
            style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </g>
  )
}
