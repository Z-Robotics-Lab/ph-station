/**
 * The 技能库 graph canvas: the React Flow surface that draws the global
 * left→right vault layout. Renders three visually distinct node kinds (skill /
 * package / capability) as different SVG silhouettes in different hues, routes
 * typed relation edges horizontally (source handle right, target handle left;
 * labeled only under the cursor or in a node's focus set), and carries a
 * collapsible legend that lists only the relations that draw. React Flow's
 * built-in MiniMap and Controls ride along. Pure presentation over graph.ts's
 * fold — no statistic.
 *
 * Split out of VaultView so the same surface renders under the plugin (real
 * board data) and under a standalone harness (mock data) for visual proofs.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Background, Controls, Handle, MiniMap, Position, ReactFlow } from '@xyflow/react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  ALL_KINDS, KIND_COLOR, layout, NODE_SIZE, REL_COLOR, relTallies,
} from './graph.ts'
import type {
  CapabilityNode, PackageNode, RelTally, SkillNode,
  VaultFilters, VaultGraph, VaultKind, VaultNode, VaultRel,
} from './graph.ts'
import css from './VaultView.module.css'

/** The bound locale reader for this view's namespace. */
type Tr = PropsLocale<'phvault'>['t']

/** A faint fill of a kind hue, for the node silhouettes. */
function tint(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`
}

/** MiniMap dot color per node kind, matching the silhouette hue. */
const miniMapColor = (type: string | undefined): string =>
  KIND_COLOR[type as VaultKind] ?? 'var(--dsw-alias-label-tertiary, #9aa1ac)'

// --- kind glyphs (tabler outline path data, MIT; see THIRD_PARTY_NOTICES) ----

/** A kind's tabler glyph (skill=bulb, package=box, capability=plug), inheriting
 * the surrounding text color. Vendored inline here rather than pulled from the
 * icons leaf so this panel stays self-contained (bulb/plug are not yet in it). */
function KindGlyph({ kind, size = 14 }: { kind: VaultKind; size?: number }) {
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

/** Left target + right source handles: React Flow v12 drops any edge whose
 * endpoints expose no handle (LR flow → target left, source right). Muted. */
function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} className={css.handle} />
      <Handle type="source" position={Position.Right} isConnectable={false} className={css.handle} />
    </>
  )
}

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

function SkillGraphNode({ data }: { data: { node: VaultNode; dimmed: boolean } }) {
  const n = data.node as SkillNode
  // Round the raw held-out delta: the board sends a full-precision float
  // (0.65 - 0.585 = 0.06500000000000006) that reads as noise in a node body.
  const rawDelta = n.evidence?.heldout_delta
  const delta = rawDelta === undefined ? undefined : Number(rawDelta.toFixed(3))
  return (
    <ShapeFrame kind="skill" dimmed={data.dimmed}>
      <div className={css.gtitle}><KindGlyph kind="skill" /><span>{n.label ?? n.id.slice(0, 12)}</span></div>
      <div className={css.gsub}>
        <span className={`${css.gstatus} ${css[`st_${n.status}`] ?? ''}`}>{n.status}</span>
        {n.privilege ? <span className={`${css.gstatus} ${css.gpriv}`}>priv {n.privilege}</span> : null}
      </div>
      {/* Disambiguates same-family candidates (identical label + status) by the
          generation and held-out delta the fold already carries. */}
      {(n.generation !== undefined || delta !== undefined) ? (
        <div className={css.gmeta}>
          {n.generation !== undefined ? <span>gen{n.generation}</span> : null}
          {delta !== undefined ? <span>Δ{delta}</span> : null}
        </div>
      ) : null}
    </ShapeFrame>
  )
}

function PackageGraphNode({ data }: { data: { node: VaultNode; dimmed: boolean } }) {
  const n = data.node as PackageNode
  return (
    <ShapeFrame kind="package" dimmed={data.dimmed}>
      <div className={css.gtitle}><KindGlyph kind="package" /><span>{n.name ?? n.id}</span></div>
      <div className={`${css.gsub} ${css.mono}`}>{n.id}</div>
    </ShapeFrame>
  )
}

function CapabilityGraphNode({ data }: { data: { node: VaultNode; dimmed: boolean } }) {
  const n = data.node as CapabilityNode
  return (
    <ShapeFrame kind="capability" dimmed={data.dimmed}>
      <div className={`${css.gtitle} ${css.mono}`}><KindGlyph kind="capability" /><span>{n.id}</span></div>
      {n.privileged ? <div className={css.gsub}>privileged</div> : null}
    </ShapeFrame>
  )
}

// --- collapsible legend ------------------------------------------------------

/** The relation/kind key. Opens collapsed (the field below it is more useful at
 * a glance); lists only the relations that draw an edge, each with its
 * `rendered/total` fold tally so the four never-drawn families (their targets
 * are tasks/campaigns/evidence, not nodes) do not read as missing edges. */
function Legend({ t, rels, tallies }: { t: Tr; rels: readonly VaultRel[]; tallies: Record<VaultRel, RelTally> }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={css.legend}>
      <button type="button" className={css.legendHead} onClick={() => { setOpen(o => !o) }}>
        <span>{t('legend.title')}</span>
        <span className={css.legendToggle}>{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div className={css.legendBody}>
          <div className={css.legendKinds}>
            {ALL_KINDS.map(k => (
              <div key={k} className={css.legendKind} style={{ color: KIND_COLOR[k] }}>
                <span className={`${css.legendShape} ${css[`ls_${k}`]}`} />
                <KindGlyph kind={k} size={12} />
                <span className={css.legendName}>{t(`kind.${k}` as const)}</span>
              </div>
            ))}
          </div>
          <div className={css.legendRels}>
            <div className={css.legendSub}>{t('legend.relations')}</div>
            <div className={css.legendRelGrid}>
              {rels.map(r => (
                <div key={r} className={css.legendRel}>
                  <span className={css.legendLine} style={{ background: REL_COLOR[r] }} />
                  <span>{r}</span>
                  <span className={css.legendCount}>{tallies[r].rendered}/{tallies[r].total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// --- the canvas --------------------------------------------------------------

/** Focus set: the edges incident to the focused node plus the nodes they touch
 * (the focused node and its direct neighbors). */
interface Focus { edges: ReadonlySet<string>; nodes: ReadonlySet<string> }

/** The grouped vault graph surface.
 * @param graph - the board vault fold.
 * @param filters - the live kind/status/relation/search selection.
 * @param onSelect - open a node's wiki page (on double-click).
 * @param t - the bound `phvault` locale reader.
 */
export function VaultGraphCanvas({
  graph, filters, onSelect, t,
}: { graph: VaultGraph; filters: VaultFilters; onSelect: (id: string) => void; t: Tr }) {
  const flow = useMemo(() => layout(graph, filters), [graph, filters])
  const tallies = useMemo(() => relTallies(graph), [graph])

  // Refit after the pane sizes: this canvas embeds in a dockview pane that lays
  // out after mount, so the one-shot onInit fitView can run against a zero-size
  // pane. A ResizeObserver rAF-debounces the refit so the frame settles once the
  // pane reaches its real width (mirrors LiveGraphView's canvas refit).
  const canvasRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<(() => void) | null>(null)
  /* jscpd:ignore-start */
  // Per-panel copy on purpose: each panel owns its own refit so no panel imports
  // another's provider or a shared hook across the panel-independence boundary
  // (LiveGraphView keeps the mirror copy).
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => { fitRef.current?.() })
    })
    ro.observe(el)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])
  /* jscpd:ignore-end */
  const shownRels = useMemo(() => flow.edges.length === 0
    ? [] : Object.keys(tallies).filter((r): r is VaultRel => tallies[r as VaultRel].rendered > 0), [tallies, flow])

  // Single-click focuses a node (highlight its edges, dim the rest); a labeled
  // edge appears only under the cursor or in the focus set, so the resting
  // canvas carries no mid-arc text. Double-click opens the wiki page.
  const [focusId, setFocusId] = useState<string | null>(null)
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
    skill: SkillGraphNode, package: PackageGraphNode, capability: CapabilityGraphNode,
  }), [])

  const rfNodes = useMemo(() => flow.nodes.map(n => ({
    id: n.id, type: n.type, position: n.position, data: n.data,
    // Fixed dimensions so React Flow routes edges without waiting on its
    // ResizeObserver (which never fires in a headless/backgrounded tab).
    width: NODE_SIZE[n.type].width, height: NODE_SIZE[n.type].height,
    draggable: false, connectable: false, selectable: true, zIndex: 10,
    // Fade every node outside the focused node's neighborhood.
    ...(focus !== null && !focus.nodes.has(n.id) ? { style: { opacity: 0.22 } } : {}),
  })), [flow, focus])

  const rfEdges = useMemo(() => flow.edges.map((e) => {
    const incident = focus?.edges.has(e.id) ?? false
    const faded = focus !== null && !incident
    const showLabel = incident || hoverEdge === e.id
    const color = REL_COLOR[e.rel]
    return {
      id: e.id, source: e.source, target: e.target,
      // Only the focused node's edges reroute orthogonally (a comb of
      // right-angles); every other edge stays bezier so the whole graph does
      // not turn into overlapping vertical trunks.
      type: incident ? 'smoothstep' : 'default',
      zIndex: incident ? 6 : 5,
      // Label only under the cursor or in the focus set — no resting mid-arc text.
      ...(showLabel ? { label: e.label, labelShowBg: true } : { labelShowBg: false }),
      labelBgPadding: [4, 2] as [number, number],
      labelBgStyle: { fill: 'var(--dsw-alias-bg-layer-1, #fff)', fillOpacity: 0.9 },
      labelStyle: { fill: color, fontSize: 9, fontWeight: 600 },
      style: { stroke: color, strokeWidth: incident ? 2 : 1.4, opacity: faded ? 0.06 : 1 },
      markerEnd: (faded ? undefined : { type: 'arrowclosed', color, width: 14, height: 14 }) as unknown as string,
    }
  }), [flow, focus, hoverEdge])

  return (
    <div className={css.canvas} ref={canvasRef}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(_e, node) => { setFocusId(id => id === node.id ? null : node.id) }}
        onNodeDoubleClick={(_e, node) => { onSelect(node.id) }}
        onPaneClick={() => { setFocusId(null) }}
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
        <MiniMap
          position="top-right" pannable zoomable
          nodeColor={n => miniMapColor(n.type)} nodeStrokeWidth={2}
          bgColor="var(--dsw-alias-bg-layer-1, #fff)"
          maskColor="color-mix(in srgb, currentColor 14%, transparent)"
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      <Legend t={t} rels={shownRels} tallies={tallies} />
      <div className={css.graphHint}>{t('graph.hint')}</div>
    </div>
  )
}
