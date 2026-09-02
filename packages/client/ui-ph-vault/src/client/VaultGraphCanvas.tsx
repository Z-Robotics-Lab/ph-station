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
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, useStore } from '@xyflow/react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  ALL_KINDS, KIND_COLOR, layout, NODE_SIZE, nodeSize, REL_COLOR, relTallies,
} from './graph.ts'
import type {
  BenchmarkNode, CapabilityNode, ClassNode, PackageNode, RelTally, SkillNode,
  VaultFilters, VaultGraph, VaultKind, VaultNode, VaultRel,
} from './graph.ts'
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

/** Node data: the vault body plus the instance-collapse state and its toggle. */
interface NodeData {
  node: VaultNode
  dimmed: boolean
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

function ClassGraphNode({ data }: { data: { node: VaultNode; dimmed: boolean } }) {
  const n = data.node as ClassNode
  const lod = useLod()
  return (
    <ShapeFrame kind="class" dimmed={data.dimmed}>
      {lod === 'far' ? <FarGlyph kind="class" /> : (
        <div className={css.gtitle}><KindGlyph kind="class" /><span>{n.name ?? n.id} · {n.skills ?? n.count ?? 0}</span></div>
      )}
    </ShapeFrame>
  )
}

function BenchmarkGraphNode({ data }: { data: { node: VaultNode; dimmed: boolean } }) {
  const n = data.node as BenchmarkNode
  const lod = useLod()
  return (
    <ShapeFrame kind="benchmark" dimmed={data.dimmed}>
      {lod === 'far' ? <FarGlyph kind="benchmark" /> : (
        <>
          <div className={css.gtitle}><KindGlyph kind="benchmark" /><span>{n.name ?? n.id}</span></div>
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
 * @param graph - the board vault fold (or the selection's neighborhood of it).
 * @param filters - the live kind/status/relation/search selection.
 * @param selected - the selected node id: its incident edges are highlighted.
 * @param onSelect - select a node (single click; the tree and detail follow).
 * @param expanded - generic skills whose instances draw (their badge reads −n).
 * @param onToggle - flip one generic's instance collapse (the badge click).
 * @param t - the bound `phvault` locale reader.
 */
export function VaultGraphCanvas({
  graph, filters, selected = null, onSelect, expanded, onToggle, t,
}: {
  graph: VaultGraph
  filters: VaultFilters
  selected?: string | null
  onSelect: (id: string) => void
  expanded?: ReadonlySet<string> | undefined
  onToggle?: ((id: string) => void) | undefined
  t: Tr
}) {
  const flow = useMemo(() => layout(graph, filters), [graph, filters])
  const tallies = useMemo(() => relTallies(graph), [graph])

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
  const shownRels = useMemo(() => flow.edges.length === 0
    ? [] : Object.keys(tallies).filter((r): r is VaultRel => tallies[r as VaultRel].rendered > 0), [tallies, flow])

  // The selected node is the focus (highlight its edges, dim the rest); a
  // labeled edge appears only under the cursor or in the focus set, so the
  // resting canvas carries no mid-arc text.
  const focusId = selected
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
    skill: SkillGraphNode, class: ClassGraphNode, benchmark: BenchmarkGraphNode,
    package: PackageGraphNode, capability: CapabilityGraphNode,
  }), [])

  const instancesTitle = t('graph.instances')
  const rfNodes = useMemo(() => flow.nodes.map(n => ({
    id: n.id, type: n.type, position: n.position,
    data: { ...n.data, expanded: expanded?.has(n.id) ?? false, onToggle, instancesTitle } satisfies NodeData,
    // Fixed dimensions so React Flow routes edges without waiting on its
    // ResizeObserver (which never fires in a headless/backgrounded tab).
    ...nodeSize(n.data.node),
    draggable: false, connectable: false, selectable: true, zIndex: 10,
    // Fade every node outside the focused node's neighborhood.
    ...(focus !== null && !focus.nodes.has(n.id) ? { style: { opacity: 0.22 } } : {}),
  })), [flow, focus, expanded, onToggle, instancesTitle])

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
        onNodeClick={(_e, node) => { onSelect(node.id) }}
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
      <Legend t={t} rels={shownRels} tallies={tallies} />
      <div className={css.graphHint}>{t('graph.hint')}</div>
    </div>
  )
}
