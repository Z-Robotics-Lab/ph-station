/**
 * The 技能库 graph canvas: the React Flow surface that draws graph.ts's layered
 * layout — 能力 | 卡片 | 技能 columns, one parent swimlane node per class,
 * column / sub-group headers, and (behind the 前置/保证 chip) predicate nodes.
 * Renders the vault kinds as different SVG silhouettes in different hues and
 * routes every edge as a smoothstep, picking the handle side from the column
 * order so a cross-column edge runs straight between neighbors; labels only
 * under the cursor or in the selection's focus set. React Flow's built-in
 * MiniMap and Controls ride along. Pure presentation over graph.ts — no
 * statistic; the relation chips and the legend live in VaultView above it.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Background, BaseEdge, Controls, EdgeLabelRenderer, Handle, MiniMap, Position, ReactFlow, useStore } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { absolutePosition, KIND_COLOR, NODE_SIZE, PRED_COLOR, REL_COLOR } from './graph.ts'
import type {
  BenchmarkNode, CapabilityNode, EdgeRel, PackageNode, SkillNode, VaultKind, VaultLayout, VaultNode,
} from './graph.ts'
import type { PhVaultKey } from './locales.ts'
import css from './VaultView.module.css'

/** The bound locale reader for this view's namespace. */
type Tr = PropsLocale<'phvault'>['t']

/** Level of detail from the live viewport zoom (xyflow store; zero deps). `far`
 * reads a node as its kind silhouette + glyph only, `mid` adds the identifying
 * name (and a skill's status), `near` is the full card. Only the content
 * changes with zoom — the silhouette and footprint are constant. The whole vault
 * DAG fits at ~0.48, so the bands sit lower than the linear execution graph's:
 * the default frame is `mid` (labels stay), and `far` is a deliberate zoom-out
 * to the silhouette overview. */
type Lod = 'far' | 'mid' | 'near'
function useLod(): Lod {
  return useStore((s) => {
    const z = s.transform[2]
    return z < 0.4 ? 'far' : z < 0.72 ? 'mid' : 'near'
  })
}

/** A faint fill of a kind hue, for the node silhouettes. */
function tint(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`
}

/** MiniMap dot color per node kind, matching the silhouette hue. */
const miniMapColor = (type: string | undefined): string =>
  KIND_COLOR[type as VaultKind] ?? 'var(--dsw-alias-label-tertiary, #9aa1ac)'

/* jscpd:ignore-start */
// Per-panel copy on purpose (LiveGraphView keeps the mirror): the MiniMap
// collapse preference is the same UI idiom the execution graph runs, but the
// two graph panels stay decoupled rather than import a shared hook across the
// panel-independence boundary (same rule as this file's refit-observer twin).
/** Persisted per-surface MiniMap collapse preference: `true`/`false` once the
 * operator toggles, `null` while none is saved so the pane width drives the
 * default (collapsed when narrow). Private-mode storage failures read as null. */
function readMiniPref(surface: string): boolean | null {
  try {
    const v = localStorage.getItem(`ph:${surface}:minimap`)
    return v === '1' ? true : v === '0' ? false : null
  } catch { return null }
}
function writeMiniPref(surface: string, collapsed: boolean): void {
  try { localStorage.setItem(`ph:${surface}:minimap`, collapsed ? '1' : '0') } catch { /* private mode: session-only */ }
}
/** Below this pane width the MiniMap defaults collapsed (it otherwise covers a
 * narrow graph); an explicit operator toggle overrides the width default. */
const MINI_NARROW = 1000
/* jscpd:ignore-end */

/** The map/map-off toggle glyph (tabler outline, MIT; see THIRD_PARTY_NOTICES),
 * vendored inline like KindGlyph so this panel keeps no icons-leaf dependency. */
function MapGlyph({ off }: { off: boolean }) {
  return (
    <svg
      width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M3 7l6 -3l6 3l6 -3v13l-6 3l-6 -3l-6 3v-13" />
      <path d="M9 4v13" />
      <path d="M15 7v13" />
      {off ? <path d="M3 3l18 18" /> : null}
    </svg>
  )
}

// --- kind glyphs (tabler outline path data, MIT; see THIRD_PARTY_NOTICES) ----

/** A kind's tabler glyph (skill=bulb, class=folder, benchmark=target,
 * package=box, capability=plug), inheriting the surrounding text color.
 * Vendored inline here rather than pulled from the icons leaf so this panel
 * stays self-contained (bulb/plug are not yet in it). */
export function KindGlyph({ kind, size = 14 }: { kind: VaultKind; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      {kind === 'skill' ? (
        <>
          <path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7" />
          <path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3" />
          <path d="M9.7 17l4.6 0" />
        </>
      ) : kind === 'class' ? (
        <path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2" />
      ) : kind === 'benchmark' ? (
        <>
          <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" />
        </>
      ) : kind === 'package' ? (
        <>
          <path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" />
          <path d="M12 12l8 -4.5" />
          <path d="M12 12l0 9" />
          <path d="M12 12l-8 -4.5" />
        </>
      ) : (
        <>
          <path d="M9.785 6l8.215 8.215l-2.054 2.054a5.81 5.81 0 1 1 -8.215 -8.215l2.054 -2.054z" />
          <path d="M4 20l3.5 -3.5" />
          <path d="M15 4l-3.5 3.5" />
          <path d="M20 9l-3.5 3.5" />
        </>
      )}
    </svg>
  )
}

// --- per-kind silhouettes ----------------------------------------------------

/** Source + target handles on both sides: an edge picks the side facing its
 * other endpoint (see {@link sides}), so a card→capability edge leaves the
 * card's left and a skill→card edge leaves the skill's left. Muted. */
function NodeHandles() {
  return (
    <>
      <Handle type="target" id="lt" position={Position.Left} isConnectable={false} className={css.handle} />
      <Handle type="source" id="ls" position={Position.Left} isConnectable={false} className={css.handle} />
      <Handle type="target" id="rt" position={Position.Right} isConnectable={false} className={css.handle} />
      <Handle type="source" id="rs" position={Position.Right} isConnectable={false} className={css.handle} />
    </>
  )
}

/** Edge stroke per painted relation (fold relations + the two predicate edges). */
const edgeColor = (rel: EdgeRel): string =>
  rel === 'requires' || rel === 'ensures' ? PRED_COLOR[rel] : REL_COLOR[rel]

/** The SVG outline for a kind, drawn to the node's fixed footprint so the three
 * kinds read apart by silhouette alone: skill = rounded card with a left accent
 * bar, package = box with a folded (notched) top-left corner, capability =
 * stadium pill. Stroke is the kind hue; fill is a faint tint of it. */
function Silhouette({ kind }: { kind: VaultKind }) {
  const { width: W, height: H } = NODE_SIZE[kind]
  const color = KIND_COLOR[kind]
  const st = { fill: tint(color, 12), stroke: color } as const
  const notch = 15
  return (
    <svg className={css.gsvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {kind === 'skill' ? (
        <>
          <rect x={1} y={1} width={W - 2} height={H - 2} rx={11} style={st} strokeWidth={2} />
          <rect x={2.5} y={7} width={6} height={H - 14} rx={3} style={{ fill: color }} />
        </>
      ) : kind === 'package' ? (
        <>
          <path
            d={`M${1 + notch} 1 H${W - 1} V${H - 1} H1 V${1 + notch} Z`}
            style={st} strokeWidth={2}
          />
          <path d={`M1 ${1 + notch} H${1 + notch} V1`} style={{ fill: 'none', stroke: color }} strokeWidth={1.4} />
        </>
      ) : kind === 'class' ? (
        <rect x={1} y={1} width={W - 2} height={H - 2} rx={6} style={st} strokeWidth={2} strokeDasharray="6 3" />
      ) : kind === 'benchmark' ? (
        <path d={`M${notch} 1 H${W - notch} L${W - 1} ${H / 2} L${W - notch} ${H - 1} H${notch} L1 ${H / 2} Z`} style={st} strokeWidth={2} />
      ) : (
        <rect x={1} y={1} width={W - 2} height={H - 2} rx={(H - 2) / 2} style={st} strokeWidth={2} />
      )}
    </svg>
  )
}

/** Shared frame: the kind silhouette behind a glyph-led content column. */
function ShapeFrame({ kind, dimmed, children }: { kind: VaultKind; dimmed: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`${css.gnode} ${css[`k_${kind}`]} ${dimmed ? css.dim : ''}`}
      style={{ color: KIND_COLOR[kind] }}
    >
      <NodeHandles />
      <Silhouette kind={kind} />
      <div className={css.gbody}>{children}</div>
    </div>
  )
}

/** The far-LOD body: the kind glyph enlarged and centered over its silhouette,
 * so a zoomed-out canvas reads by shape + hue + glyph alone (no text). */
function FarGlyph({ kind }: { kind: VaultKind }) {
  return <div className={css.gfar}><KindGlyph kind={kind} size={22} /></div>
}

/** Node data: the vault body plus the instance-collapse state and its toggle
 * (`count`: a benchmark's nested mission cards). */
interface NodeData {
  node: VaultNode
  dimmed: boolean
  count?: number | undefined
  expanded?: boolean
  onToggle?: ((id: string) => void) | undefined
  instancesTitle?: string
}

function SkillGraphNode({ data }: { data: NodeData }) {
  const n = data.node as SkillNode
  const lod = useLod()
  if (n.status === 'library') {
    return (
      <ShapeFrame kind="skill" dimmed={data.dimmed}>
        {lod === 'far' ? <FarGlyph kind="skill" /> : (
          <>
            <div className={css.gtitle}><KindGlyph kind="skill" /><span>{n.name}</span></div>
            <div className={css.gsub}>
              <span className={css.gstatus}>{n.skill_kind ?? 'segment'}</span>
              {lod === 'near' && n.class ? <span className={css.gstatus}>{n.class}</span> : null}
              {(n.instances ?? 0) > 0 ? (
                <button
                  type="button" className={`${css.gstatus} ${css.gbadge}`} title={data.instancesTitle}
                  onClick={(e) => { e.stopPropagation(); data.onToggle?.(n.id) }}
                >
                  {data.expanded ? '−' : '+'}{n.instances}
                </button>
              ) : null}
            </div>
          </>
        )}
      </ShapeFrame>
    )
  }
  // Round the raw held-out delta: the board sends a full-precision float
  // (0.65 - 0.585 = 0.06500000000000006) that reads as noise in a node body.
  const rawDelta = n.evidence?.heldout_delta
  const delta = rawDelta === undefined ? undefined : Number(rawDelta.toFixed(3))
  return (
    <ShapeFrame kind="skill" dimmed={data.dimmed}>
      {lod === 'far' ? <FarGlyph kind="skill" /> : (
        <>
          <div className={css.gtitle}><KindGlyph kind="skill" /><span>{n.label ?? n.id.slice(0, 12)}</span></div>
          <div className={css.gsub}>
            <span className={`${css.gstatus} ${css[`st_${n.status}`] ?? ''}`}>{n.status}</span>
            {lod === 'near' && n.privilege ? <span className={`${css.gstatus} ${css.gpriv}`}>priv {n.privilege}</span> : null}
          </div>
          {/* Disambiguates same-family candidates (identical label + status) by the
              generation and held-out delta the fold already carries. Near only. */}
          {lod === 'near' && (n.generation !== undefined || delta !== undefined) ? (
            <div className={css.gmeta}>
              {n.generation !== undefined ? <span>gen{n.generation}</span> : null}
              {delta !== undefined ? <span>Δ{delta}</span> : null}
            </div>
          ) : null}
        </>
      )}
    </ShapeFrame>
  )
}

function PackageGraphNode({ data }: { data: { node: VaultNode; dimmed: boolean } }) {
  const n = data.node as PackageNode
  const lod = useLod()
  return (
    <ShapeFrame kind="package" dimmed={data.dimmed}>
      {lod === 'far' ? <FarGlyph kind="package" /> : (
        <>
          <div className={css.gtitle}><KindGlyph kind="package" /><span>{n.name ?? n.id}</span></div>
          {lod === 'near' ? <div className={`${css.gsub} ${css.mono}`}>{n.id}</div> : null}
        </>
      )}
    </ShapeFrame>
  )
}

function BenchmarkGraphNode({ data }: { data: NodeData }) {
  const n = data.node as BenchmarkNode
  const lod = useLod()
  return (
    <ShapeFrame kind="benchmark" dimmed={data.dimmed}>
      {lod === 'far' ? <FarGlyph kind="benchmark" /> : (
        <>
          <div className={css.gtitle}><KindGlyph kind="benchmark" /><span>{n.name ?? n.id}</span>{data.count ? <span className={css.laneCount}>· {data.count}</span> : null}</div>
          {n.embodiment ? <div className={css.gsub}>{n.embodiment}</div> : null}
        </>
      )}
    </ShapeFrame>
  )
}

function CapabilityGraphNode({ data }: { data: { node: VaultNode; dimmed: boolean } }) {
  const n = data.node as CapabilityNode
  const lod = useLod()
  return (
    <ShapeFrame kind="capability" dimmed={data.dimmed}>
      {lod === 'far' ? <FarGlyph kind="capability" /> : (
        <>
          <div className={`${css.gtitle} ${css.mono}`}><KindGlyph kind="capability" /><span>{n.id}</span></div>
          {lod === 'near' && n.privileged ? <div className={css.gsub}>privileged</div> : null}
        </>
      )}
    </ShapeFrame>
  )
}

/** A class swimlane (xyflow parent node): header `grasp · 14` with a fold
 * chevron; the generic skills are its children. Selectable like a class. */
function LaneNode({ data }: { data: LaneData }) {
  const label = data.label ?? (data.key === undefined ? '' : data.t(data.key as PhVaultKey))
  return (
    <div className={`${css.lane} ${data.open ? css.laneOpen : ''} ${data.dimmed ? css.dim : ''}`}>
      <NodeHandles />
      <div className={css.laneHead}>
        <KindGlyph kind="class" size={13} />
        <span className={css.laneName}>{label}</span>
        <span className={css.laneCount}>· {data.count ?? 0}</span>
        {data.onToggle ? (
          <button
            type="button" className={css.chev} title={data.t(data.open ? 'pane.collapse' : 'pane.expand')}
            aria-label={`${label}: ${data.t(data.open ? 'pane.collapse' : 'pane.expand')}`}
            onClick={(e) => { e.stopPropagation(); data.onToggle?.(data.id) }}
          >
            {data.open ? '▾' : '▸'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** A column or sub-group header: plain text, not selectable. */
function HeaderNode({ data }: { data: LaneData }) {
  return (
    <div className={`${css.colHead} ${data.id.startsWith('group:') ? css.groupHead : ''}`}>
      {data.label ?? data.t(data.key as PhVaultKey)}{data.count === undefined ? '' : ` · ${data.count}`}
    </div>
  )
}

/** One requires/ensures predicate ref, drawn between the skills it links. */
function PredicateNode({ data }: { data: LaneData }) {
  return (
    <div className={`${css.pred} ${css.mono}`}>
      <NodeHandles />
      {data.label}
    </div>
  )
}

/** Node data for lanes, headers, and predicates: the layout's label fields
 * plus the bound locale reader and the lane fold toggle. */
interface LaneData {
  id: string
  label?: string | undefined
  key?: string | undefined
  count?: number | undefined
  open?: boolean | undefined
  dimmed: boolean
  t: Tr
  onToggle?: ((id: string) => void) | undefined
}

// --- edge routing ------------------------------------------------------------

/** Handle sides for an edge from `a` to `b`: neighbors across columns face
 * each other; nodes in one column both use their right side (a U-turn beside
 * the column). */
function sides(a: { x: number; w: number }, b: { x: number; w: number }): { sourceHandle: string; targetHandle: string } {
  if (a.x + a.w <= b.x) return { sourceHandle: 'rs', targetHandle: 'lt' }
  if (b.x + b.w <= a.x) return { sourceHandle: 'ls', targetHandle: 'rt' }
  return { sourceHandle: 'rs', targetHandle: 'rt' }
}

/** A class-level DEPENDS_ON arc: leaves the source lane's right side, bows
 * `data.offset` px to the right, and lands on the target lane's right side
 * with an arrowhead; its `×n` count rides the bow (always visible). */
function ArcEdge({ id, sourceX, sourceY, targetX, targetY, data, style, markerEnd, label }: EdgeProps) {
  const off = (data as { offset: number }).offset
  const path = `M ${sourceX} ${sourceY} C ${sourceX + off} ${sourceY}, ${targetX + off} ${targetY}, ${targetX} ${targetY}`
  const mx = (sourceX + targetX) / 2 + off * 0.75, my = (sourceY + targetY) / 2
  return (
    <>
      <BaseEdge id={id} path={path} {...(style === undefined ? {} : { style })} {...(markerEnd === undefined ? {} : { markerEnd })} />
      {label ? (
        <EdgeLabelRenderer>
          <div className={css.arcLabel} style={{ transform: `translate(-50%, -50%) translate(${mx}px, ${my}px)`, color: style?.stroke, opacity: style?.opacity }}>{label}</div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

// --- the canvas --------------------------------------------------------------

/** Focus set: the edges incident to the focused node plus the nodes they touch
 * (the focused node and its direct neighbors). */
interface Focus { edges: ReadonlySet<string>; nodes: ReadonlySet<string> }

/** The layered vault graph surface.
 * @param flow - the laid-out canvas (graph.ts `layered`).
 * @param selected - the selected node id: its incident edges are highlighted.
 * @param onSelect - select a node (single click; the tree and detail follow).
 * @param expanded - generic skills whose instances draw (their badge reads −n).
 * @param onToggle - flip one generic's instance collapse (the badge click).
 * @param onToggleClass - fold / unfold one class swimlane (the lane chevron).
 * @param t - the bound `phvault` locale reader.
 */
export function VaultGraphCanvas({
  flow, selected = null, onSelect, expanded, onToggle, onToggleClass, t,
}: {
  flow: VaultLayout
  selected?: string | null
  onSelect: (id: string) => void
  expanded?: ReadonlySet<string> | undefined
  onToggle?: ((id: string) => void) | undefined
  onToggleClass?: ((id: string) => void) | undefined
  t: Tr
}) {
  // Refit after the pane sizes: this canvas embeds in a dockview pane that lays
  // out after mount, so the one-shot onInit fitView can run against a zero-size
  // pane. A ResizeObserver rAF-debounces the refit so the frame settles once the
  // pane reaches its real width (mirrors LiveGraphView's canvas refit).
  const canvasRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<(() => void) | null>(null)
  // Live pane width drives the MiniMap collapse default (narrow → collapsed).
  const [paneW, setPaneW] = useState(0)
  /* jscpd:ignore-start */
  // Per-panel copy on purpose: each panel owns its own refit so no panel imports
  // another's provider or a shared hook across the panel-independence boundary
  // (LiveGraphView keeps the mirror copy).
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    setPaneW(el.clientWidth)
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => { setPaneW(el.clientWidth); fitRef.current?.() })
    })
    ro.observe(el)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])
  /* jscpd:ignore-end */

  // Refit on every graph change: a selection swaps the drawn subgraph, and the
  // old viewport (framed for the previous one) would leave it off-frame.
  useEffect(() => {
    const raf = requestAnimationFrame(() => { fitRef.current?.() })
    return () => { cancelAnimationFrame(raf) }
  }, [flow])

  // MiniMap collapse: operator preference wins; absent it, the pane width picks
  // the default (collapsed when narrow), so a small pane isn't covered on load.
  const [miniPref, setMiniPref] = useState<boolean | null>(() => readMiniPref('phvault'))
  const miniCollapsed = miniPref ?? (paneW > 0 && paneW < MINI_NARROW)
  const toggleMini = () => {
    const next = !miniCollapsed
    setMiniPref(next)
    writeMiniPref('phvault', next)
  }
  // The selected node — or the lane under the cursor — is the focus (highlight
  // its edges and arcs, dim the rest); a labeled edge appears only under the
  // cursor or in the focus set, so the resting canvas carries no mid-arc text.
  const [hoverLane, setHoverLane] = useState<string | null>(null)
  const focusId = hoverLane ?? selected
  const [hoverEdge, setHoverEdge] = useState<string | null>(null)
  const focus = useMemo<Focus | null>(() => {
    if (focusId === null) return null
    const edges = new Set<string>()
    const nodes = new Set<string>([focusId])
    for (const e of flow.edges) {
      if (e.source === focusId || e.target === focusId) { edges.add(e.id); nodes.add(e.source); nodes.add(e.target) }
    }
    return { edges, nodes }
  }, [focusId, flow])

  const nodeTypes = useMemo(() => ({
    skill: SkillGraphNode, benchmark: BenchmarkGraphNode, package: PackageGraphNode,
    capability: CapabilityGraphNode, lane: LaneNode, header: HeaderNode, predicate: PredicateNode,
  }), [])
  const edgeTypes = useMemo(() => ({ arc: ArcEdge }), [])

  const instancesTitle = t('graph.instances')
  const rfNodes = useMemo(() => flow.nodes.map((n) => {
    const chrome = n.type === 'lane' || n.type === 'header' || n.type === 'predicate'
    const data = chrome
      ? {
        id: n.id, label: n.data.label, key: n.data.key, count: n.data.count, open: n.data.open, dimmed: n.data.dimmed, t,
        // Only a class lane folds; the history lane has no class node behind it.
        onToggle: n.type === 'lane' && n.data.node !== undefined ? onToggleClass : undefined,
      } satisfies LaneData
      : {
        node: n.data.node as VaultNode, dimmed: n.data.dimmed, count: n.data.count,
        expanded: expanded?.has(n.id) ?? false, onToggle, instancesTitle,
      } satisfies NodeData
    return {
      id: n.id, type: n.type, position: n.position, data,
      // Fixed dimensions so React Flow routes edges without waiting on its
      // ResizeObserver (which never fires in a headless/backgrounded tab).
      width: n.width, height: n.height,
      ...(n.parentId === undefined ? {} : { parentId: n.parentId, extent: 'parent' as const }),
      draggable: false, connectable: false, selectable: n.type !== 'header' && n.type !== 'predicate',
      zIndex: n.type === 'lane' ? 1 : n.type === 'header' ? 0 : 10,
      // Fade every node outside the focused node's neighborhood.
      ...(focus !== null && !chrome && !focus.nodes.has(n.id) ? { style: { opacity: 0.22 } } : {}),
    }
  }), [flow, focus, expanded, onToggle, onToggleClass, instancesTitle, t])

  const rfEdges = useMemo(() => {
    const box = new Map(flow.nodes.map(n => [n.id, { x: absolutePosition(flow.nodes, n).x, w: n.width }]))
    return flow.edges.map((e) => {
      const incident = focus?.edges.has(e.id) ?? false
      const faded = focus !== null && !incident
      const arc = e.offset !== undefined
      const showLabel = incident || hoverEdge === e.id
      const color = edgeColor(e.rel)
      const a = box.get(e.source), b = box.get(e.target)
      return {
        id: e.id, source: e.source, target: e.target,
        // An arc leaves and lands on the lanes' right sides; a plain edge faces its other endpoint.
        ...(arc ? { sourceHandle: 'rs', targetHandle: 'rt', type: 'arc', data: { offset: e.offset } }
          : { ...(a !== undefined && b !== undefined ? sides(a, b) : {}), type: 'smoothstep' }),
        zIndex: incident ? 6 : 5,
        // Label only under the cursor or in the focus set — no resting mid-arc
        // text; an arc always shows its ×n.
        ...(arc && !faded ? { label: `×${e.count}` }
          : showLabel ? { label: e.label, labelShowBg: true } : { labelShowBg: false }),
        labelBgPadding: [4, 2] as [number, number],
        labelBgStyle: { fill: 'var(--dsw-alias-bg-layer-1, #fff)', fillOpacity: 0.9 },
        labelStyle: { fill: color, fontSize: 9, fontWeight: 600 },
        style: { stroke: color, strokeWidth: incident ? 2 : 1.4, opacity: faded ? 0.06 : 1 },
        markerEnd: (faded ? undefined : { type: 'arrowclosed', color, width: 14, height: 14 }) as unknown as string,
      }
    })
  }, [flow, focus, hoverEdge])

  return (
    <div className={css.canvas} ref={canvasRef}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_e, node) => { if (node.type !== 'header' && node.type !== 'predicate') onSelect(node.id) }}
        onNodeMouseEnter={(_e, node) => { if (node.type === 'lane') setHoverLane(node.id) }}
        onNodeMouseLeave={() => { setHoverLane(null) }}
        onEdgeMouseEnter={(_e, edge) => { setHoverEdge(edge.id) }}
        onEdgeMouseLeave={() => { setHoverEdge(null) }}
        // A headless/backgrounded tab never fires React Flow's ResizeObserver,
        // so the initial fitView can run against a zero-size pane; refit once
        // the instance is live to frame the whole left→right flow.
        onInit={(inst) => {
          fitRef.current = () => { void inst.fitView({ padding: 0.12, maxZoom: 1 }) }
          requestAnimationFrame(() => { fitRef.current?.() })
        }}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        minZoom={0.1}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnScroll={false}
        panOnScroll
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={18} size={1} />
        {miniCollapsed ? null : (
          <MiniMap
            position="top-right" pannable zoomable
            style={{ width: 172, height: 116 }}
            nodeColor={n => miniMapColor(n.type)} nodeStrokeWidth={2}
            bgColor="var(--dsw-alias-bg-layer-1, #fff)"
            maskColor="color-mix(in srgb, currentColor 14%, transparent)"
          />
        )}
        <Controls showInteractive={false} />
      </ReactFlow>
      <button
        type="button"
        className={`${css.miniToggle} ${miniCollapsed ? css.miniToggleLow : css.miniToggleHigh}`}
        onClick={toggleMini}
        title={t(miniCollapsed ? 'minimapShow' : 'minimapHide')}
        aria-label={t(miniCollapsed ? 'minimapShow' : 'minimapHide')}
      >
        <MapGlyph off={!miniCollapsed} />
      </button>
      <div className={css.graphHint}>{t('graph.hint')}</div>
    </div>
  )
}
