/**
 * 执行图谱 — the merged execution-graph panel: one React Flow canvas that reads
 * as plan → route → result. It composes, over the newest runtime session,
 *
 * - the TASK PLAN with replan lineage (`plan_built` + `node_start` forks),
 * - the collapsible capability ROUTING fan (chain `capability.resolve` rows),
 * - LIVE node/stage animation from `runtimeEvents` (incremental cursor),
 *
 * and adds LIVE / HISTORY modes: a scrubber replays any past run by folding the
 * feed truncated to the playhead seq (`graph.ts` folds any prefix). Clicking a
 * node opens its evidence. Renders only — every status is copied from board
 * payloads; the fold computes nothing.
 *
 * Poll cadence: ~1.2s while a task is in flight, ~4s idle, paused while hidden.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background, Controls, Handle, MiniMap, Panel, Position, ReactFlow, useReactFlow, useStore,
} from '@xyflow/react'
import { IconBroadcast, IconPlayerPause, IconPlayerPlay } from '@deepseek-ai/dsh-client-ui-ph-icons'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { foldEvents, layout, NODE_SIZE } from './graph.ts'
import type { LiveGraphModel, NodeStatus, PlanNodeState, RoutingRow, RunInfo } from './graph.ts'
import type { FeedInjected } from './useLiveFeed.ts'
import { useRunFeed } from './RunFeed.tsx'
import css from './LiveGraphView.module.css'

/** The board reads the graph drives (the shared feed face). */
export type LiveGraphInjected = FeedInjected

const STATUS_CLASS: Record<NodeStatus, string> = {
  pending: css.stPending ?? '',
  running: css.stRunning ?? '',
  verified: css.stVerified ?? '',
  failed: css.stFailed ?? '',
  replanned: css.stReplanned ?? '',
}

type T = PropsLocale<'phlivegraph'>['t']

// Floor the fit-to-view zoom: a wide-but-flat chain (11 M-nodes in one dagre LR
// row) otherwise fits-to-width at ~0.27 zoom, shrinking 13px labels to ~4px —
// unreadable on the flagship watch surface. Below this, stop shrinking and let
// the chain overflow with horizontal pan (panOnDrag) rather than go illegible.
const FIT_MIN_ZOOM = 0.35

/** Level of detail from the live viewport zoom (xyflow store; zero deps). Three
 * bands trade a node's content for legibility: `far` reads only status+identity,
 * `mid` adds a name and a stage-count badge, `near` is the full card. The dagre
 * footprint never changes — only what fills it — so positions stay stable as the
 * operator zooms. */
type Lod = 'far' | 'mid' | 'near'
function useLod(): Lod {
  return useStore((s) => {
    const z = s.transform[2]
    return z < 0.55 ? 'far' : z < 0.9 ? 'mid' : 'near'
  })
}

/** Verified/failed tally across a node's stages, for the `mid`-band summary badge. */
function stageTally(stages: PlanNodeState['stages']): { ok: number; bad: number } {
  let ok = 0; let bad = 0
  for (const s of stages) { if (s.status === 'verified') ok++; else if (s.status === 'failed') bad++ }
  return { ok, bad }
}

function MissionNode({ data, t }: { data: { model: LiveGraphModel } } & PropsLocale<'phlivegraph'>) {
  const m = data.model
  const status = m.task?.status
  const ring = status === 'running' ? css.stRunning : status === 'failed' ? css.stFailed : status === 'done' ? css.stVerified : css.stPending
  return (
    <div className={`${css.node} ${css.mission} ${ring}`}>
      <Handle type="target" position={Position.Top} id="in" className={css.handle} />
      <div className={css.nodeTitle}>
        {m.task?.task ?? t('idle')}
        {m.task?.seed !== undefined ? <span className={css.mono}> #{m.task.seed}</span> : null}
      </div>
      <div className={css.nodeSub}>{m.goal ?? t('goal')}</div>
      <div className={css.badges}>
        {status ? <span className={css.badge}>{t(status === 'running' ? 'running' : status === 'failed' ? 'failed' : 'done')}</span> : null}
        {m.replans > 0 ? <span className={`${css.badge} ${css.badgeAmber}`}>{t('replans')} {m.replans}</span> : null}
      </div>
      <Handle type="source" position={Position.Right} id="out" className={css.handle} />
      <Handle type="source" position={Position.Bottom} id="cap" className={css.handle} />
    </div>
  )
}

function PlanNode({ data, t }: { data: { node: PlanNodeState; predicate?: string } } & PropsLocale<'phlivegraph'>) {
  const n = data.node
  const lod = useLod()
  const running = n.status === 'running'

  // far: a status-colored pill — identity + state only, so a wrapped 11-node
  // chain reads at a glance without any card chrome.
  if (lod === 'far') {
    return (
      <div className={`${css.node} ${css.plan} ${css.planFar} ${STATUS_CLASS[n.status]}`} title={`${n.skill} · ${n.id}`}>
        <Handle type="target" position={Position.Left} id="in" className={css.handle} />
        <span className={css.farDot} />
        <span className={css.farLabel}>{n.skill}</span>
        {n.attempt > 0 ? <span className={css.farReplan} title={t('replans')}>▲{n.attempt}</span> : null}
        <Handle type="source" position={Position.Right} id="out" className={css.handle} />
      </div>
    )
  }

  // mid: name + id + one stage-tally badge (not the full chip strip) + cursor.
  if (lod === 'mid') {
    const { ok, bad } = stageTally(n.stages)
    return (
      <div className={`${css.node} ${css.plan} ${STATUS_CLASS[n.status]}`}>
        <Handle type="target" position={Position.Left} id="in" className={css.handle} />
        {running ? <span className={css.cursorTag}>▶ {t('current')}</span> : null}
        <div className={css.nodeTitle}>
          {n.skill}
          <span className={css.mono}> {n.id}</span>
        </div>
        <div className={css.midRow}>
          {n.stages.length === 0
            ? <span className={css.nodeSub}>{t(`legend.${n.status}` as const)}</span>
            : (
              <span className={css.tallyBadge}>
                {ok > 0 ? <span className={css.tallyOk}>✓{ok}</span> : null}
                {bad > 0 ? <span className={css.tallyBad}>✗{bad}</span> : null}
              </span>
            )}
          {n.ms !== undefined ? <span className={css.meta}><span className={css.mono}>{(n.ms / 1000).toFixed(1)}s</span></span> : null}
        </div>
        <Handle type="source" position={Position.Right} id="out" className={css.handle} />
      </div>
    )
  }

  // near: the full card — stage chips, step/time/fault meta, verify predicate.
  return (
    <div className={`${css.node} ${css.plan} ${STATUS_CLASS[n.status]}`}>
      <Handle type="target" position={Position.Left} id="in" className={css.handle} />
      {running ? <span className={css.cursorTag}>▶ {t('current')}</span> : null}
      <div className={css.nodeTitle}>
        {n.skill}
        <span className={css.mono}> {n.id}</span>
      </div>
      <div className={css.stageRow}>
        {n.stages.length === 0
          ? <span className={css.nodeSub}>{t(`legend.${n.status}` as const)}</span>
          : n.stages.map((s, i) => (
            <span key={`${s.name}:${i}`} className={`${css.stageChip} ${STATUS_CLASS[s.status]}`}>
              {s.status === 'verified' ? '✓' : s.status === 'failed' ? '✗' : ''} {s.name}
            </span>
          ))}
      </div>
      <div className={css.metaRow}>
        {n.steps !== undefined ? <span className={css.meta}>{t('steps')} <span className={css.mono}>{n.steps}</span></span> : null}
        {n.ms !== undefined ? <span className={css.meta}><span className={css.mono}>{(n.ms / 1000).toFixed(1)}s</span></span> : null}
        {n.faults?.length ? <span className={`${css.meta} ${css.metaFault}`}>{t('faults')} {n.faults.length}</span> : null}
        {data.predicate ? <span className={css.predChip} title={t('verify')}>⊨ {data.predicate}</span> : null}
      </div>
      <Handle type="source" position={Position.Right} id="out" className={css.handle} />
    </div>
  )
}

function CapNode({ data, t }: { data: { cap: RoutingRow } } & PropsLocale<'phlivegraph'>) {
  const cap = data.cap
  const tail = cap.ref.split(':').pop() ?? cap.ref
  return (
    <div className={`${css.node} ${css.cap}`} title={cap.ref}>
      <Handle type="target" position={Position.Left} id="in" className={css.handle} />
      <div className={css.capName}>
        {cap.capability}
        {cap.privileged ? <span className={css.privDot} title={t('privileged')} /> : null}
      </div>
      <div className={`${css.nodeSub} ${css.mono}`}>{tail}</div>
    </div>
  )
}

/** MiniMap dot color per node status/kind, matching the node border vocabulary. */
const MINI_COLOR: Record<NodeStatus, string> = {
  pending: '#9aa1ac', running: '#d97706', verified: '#16a34a', failed: '#dc2626', replanned: '#d97706',
}
function miniColor(node: { type?: string | undefined; data?: unknown }): string {
  if (node.type === 'mission') return '#2563eb'
  if (node.type === 'cap') return '#8b5cf6'
  const n = (node.data as { node?: PlanNodeState } | undefined)?.node
  return n ? MINI_COLOR[n.status] : '#9aa1ac'
}

/** The Fit / 100% zoom cluster — an explicit handle back to a readable frame
 * after the operator pans or hits the fit floor on a wide chain. Rides inside
 * the flow so `useReactFlow` binds to this canvas's instance. */
function ZoomCluster({ t, fitOpts }: { t: T; fitOpts: { padding: number; maxZoom: number; minZoom: number } }) {
  const rf = useReactFlow()
  return (
    <Panel position="top-left" className={css.zoomCluster}>
      <button type="button" className={css.zoomBtn} onClick={() => { void rf.fitView({ ...fitOpts, duration: 240 }) }}>{t('fit')}</button>
      <button type="button" className={css.zoomBtn} onClick={() => { void rf.zoomTo(1, { duration: 240 }) }}>100%</button>
    </Panel>
  )
}

/** The floating evidence card for the clicked node — the raw source row. */
function Evidence({ node, t, onClose }: { node: PlanNodeState; t: T; onClose: () => void }) {
  const rows: Array<[string, string]> = [
    [t('node'), `${node.skill} · ${node.id}`],
    [t('status'), t(`legend.${node.status}` as const)],
    [t('attempt'), `#${node.attempt}`],
    [t('stages'), node.stages.map(s => `${s.status === 'verified' ? '✓' : s.status === 'failed' ? '✗' : '·'}${s.name}`).join('  ') || '—'],
  ]
  if (node.steps !== undefined) rows.push([t('steps'), String(node.steps)])
  if (node.ms !== undefined) rows.push([t('duration'), `${(node.ms / 1000).toFixed(1)}s`])
  if (node.faults?.length) rows.push([t('faults'), node.faults.join(', ')])
  const args = Object.entries(node.args)
  if (args.length) rows.push([t('args'), args.map(([k, v]) => `${k}=${String(v)}`).join(', ')])
  return (
    <div className={css.evidence}>
      <div className={css.evidenceHead}>
        <span className={`${css.evidenceKind} ${STATUS_CLASS[node.status]}`}>{node.key}</span>
        <button type="button" className={css.evClose} onClick={onClose} aria-label="close">×</button>
      </div>
      <dl className={css.dl}>
        {rows.map(([k, v]) => (
          <div key={k} className={css.dlRow}><dt className={css.dt}>{k}</dt><dd className={css.dd}>{v}</dd></div>
        ))}
      </dl>
    </div>
  )
}

/** The replay scrubber: run selector + seq track + playhead + play/pause + the
 * LIVE badge, all driven off `runs` and the playhead seq. */
function Scrubber({
  runs, runIndex, run, playhead, live, playing, showRouting, t,
  onPick, onSeek, onTogglePlay, onGoLive, onToggleRouting,
}: {
  runs: RunInfo[]
  runIndex: number
  run: RunInfo | undefined
  playhead: number
  live: boolean
  playing: boolean
  showRouting: boolean
  t: T
  onPick: (i: number) => void
  onSeek: (seq: number) => void
  onTogglePlay: () => void
  onGoLive: () => void
  onToggleRouting: () => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const span = run ? Math.max(1, run.lastSeq - run.firstSeq) : 1
  const frac = run ? (playhead - run.firstSeq) / span : 0
  const seqAt = (clientX: number): number => {
    const el = trackRef.current
    if (!el || !run) return playhead
    const r = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    return Math.round(run.firstSeq + ratio * span)
  }
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    onSeek(seqAt(e.clientX))
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) onSeek(seqAt(e.clientX))
  }
  return (
    <div className={css.scrubBar} title={t('keys')}>
      <button
        type="button"
        className={`${css.liveBadge} ${live ? css.liveOn : css.liveOff}`}
        onClick={onGoLive}
        title={t(live ? 'liveOn' : 'liveOff')}
      >
        <IconBroadcast size={12} />{t(live ? 'live' : 'history')}
      </button>
      {runs.length > 0 ? (
        <select
          className={css.runPick}
          value={runIndex}
          onChange={(e) => { onPick(Number(e.target.value)) }}
        >
          {runs.map(r => (
            <option key={r.index} value={r.index}>
              {t('run')} {r.index + 1} · {r.task ?? '?'} #{r.seed ?? '?'} {r.status === 'done' && r.success !== false ? '✓' : r.status === 'running' ? '…' : '✗'}
            </option>
          ))}
        </select>
      ) : null}
      <button type="button" className={css.playBtn} onClick={onTogglePlay} disabled={!run} aria-label={t(playing ? 'pause' : 'play')}>
        {playing ? <IconPlayerPause size={13} /> : <IconPlayerPlay size={13} />}
      </button>
      <div
        ref={trackRef}
        className={css.track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <div className={css.trackFill} style={{ width: `${frac * 100}%` }} />
        {run?.markers.map(mk => (
          <span
            key={mk.seq}
            className={`${css.tick} ${mk.kind === 'node_failed' ? css.tickFail : mk.kind === 'node_verified' ? css.tickOk : mk.kind === 'replan' ? css.tickReplan : ''}`}
            style={{ left: `${((mk.seq - (run.firstSeq)) / span) * 100}%` }}
            title={mk.kind}
          />
        ))}
        <span className={css.playhead} style={{ left: `${frac * 100}%` }} />
      </div>
      <span className={css.seqCount}>{run ? `${playhead - run.firstSeq}/${run.lastSeq - run.firstSeq}` : '—'}</span>
      <label className={css.routeToggle} title={t('routingHint')}>
        <input type="checkbox" checked={showRouting} onChange={onToggleRouting} />
        {t('showRouting')}
      </label>
    </div>
  )
}

export function LiveGraphView({ t }: PropsLocale<'phlivegraph'>) {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  // A zero-arg refit closure captured in `onInit`, so the fit options bind to
  // the instance's own node generic (a typed `fitView` ref would fight the
  // literal `draggable: false` node type).
  const fitRef = useRef<(() => void) | null>(null)
  const {
    online, sessionName, sessions, selectSession, feed, sessionRows, version,
    runs, runIndex: effIndex, run, headSeq, live, playing,
    pick, seek, goLive, togglePlay,
  } = useRunFeed()

  // Track the live canvas width: it drives the serpentine wrap (a narrow pane
  // folds the chain into more rows) and refits the graph. Embedded in the
  // 图谱·过程流 split pane, React Flow's initial `fitView` runs before the pane
  // settles to its real width (and again on every gutter drag), so without this
  // nodes would sit panned off-view and the chain would never wrap to the pane.
  // A callback ref (not an effect) attaches the observer, because the canvas
  // mounts only after the loading early-returns clear — a `[]` effect would run
  // once against the null ref and never reattach.
  const [paneW, setPaneW] = useState(0)
  const roRef = useRef<ResizeObserver | null>(null)
  const rafRef = useRef(0)
  const setCanvas = useCallback((el: HTMLDivElement | null) => {
    canvasRef.current = el
    roRef.current?.disconnect()
    if (!el) { roRef.current = null; return }
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        setPaneW(el.clientWidth)
        fitRef.current?.()
      })
    })
    ro.observe(el)
    roRef.current = ro
  }, [])

  const [showRouting, setShowRouting] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const model = useMemo(() => {
    const slice = headSeq === Infinity ? feed.current : feed.current.filter(e => e.seq <= headSeq)
    return foldEvents(sessionRows.current, slice)
  }, [feed, sessionRows, version, headSeq])

  const flow = useMemo(() => layout(model, showRouting, paneW || undefined), [model, showRouting, paneW])
  // Serpentine row count as a geometry signature: when a reflow changes it, the
  // ReactFlow key below changes so the instance remounts and its `fitView` prop
  // frames the final (wrapped) nodes — the reliable fit path, versus an
  // imperative refit racing React Flow's post-paint node measurement.
  const geomSig = flow.nodes.reduce((m, n) => Math.max(m, n.position.y), 0).toFixed(0)
  // A sparse run (1-3 nodes) under the TB→LR dagre layout would otherwise sit as
  // tiny cards in a vast empty pane on a wide monitor: raise the fit cap so a
  // small graph fills the frame, keeping maxZoom≈1 only once it is large.
  const fitMax = flow.nodes.length <= 4 ? 1.8 : flow.nodes.length <= 8 ? 1.3 : 1
  const fitOpts = { padding: 0.16, maxZoom: fitMax, minZoom: FIT_MIN_ZOOM }
  // Refit after the layout geometry changes (a serpentine reflow moves every
  // node): the width-tracking observer refits against the pre-reflow DOM, so a
  // post-paint refit reframes the wrapped grid. rAF lets the new positions
  // paint first.
  useEffect(() => {
    const id = requestAnimationFrame(() => { fitRef.current?.() })
    return () => { cancelAnimationFrame(id) }
  }, [flow])
  const nodeTypes = useMemo(() => ({
    mission: (p: { data: { model: LiveGraphModel } }) => <MissionNode data={p.data} t={t} />,
    plan: (p: { data: { node: PlanNodeState; predicate?: string } }) => <PlanNode data={p.data} t={t} />,
    cap: (p: { data: { cap: RoutingRow } }) => <CapNode data={p.data} t={t} />,
  }), [t])

  const selectedNode = selectedKey ? model.planNodes.find(n => n.key === selectedKey) : undefined
  const pickRun = (i: number) => { pick(i); setSelectedKey(null) }

  // Keyboard scrubbing on the panel root — a remote browser under 300ms RTT pays
  // that latency on every pointer round-trip, so Space/←→/[]/Esc drive the same
  // useRunFeed actions without one. Skipped when a form control holds focus so
  // the run <select> and routing checkbox keep their native key behavior.
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
    const eff = headSeq === Infinity ? (run?.lastSeq ?? 0) : headSeq
    switch (e.key) {
      case ' ': e.preventDefault(); togglePlay(); break
      case 'ArrowLeft': if (run) { e.preventDefault(); seek(Math.max(run.firstSeq, eff - 1)) } break
      case 'ArrowRight': if (run) { e.preventDefault(); seek(Math.min(run.lastSeq, eff + 1)) } break
      case '[': if (effIndex > 0) { e.preventDefault(); pickRun(effIndex - 1) } break
      case ']': if (effIndex < runs.length - 1) { e.preventDefault(); pickRun(effIndex + 1) } break
      case 'Escape': setSelectedKey(null); break
      default: break
    }
  }

  if (online === false) return <div className={css.empty}>{t('unavailable')}</div>
  if (sessionName === null) return <div className={css.empty}>{t('loading')}</div>
  if (feed.current.length === 0 && model.planNodes.length === 0) {
    return (
      <div className={css.panel}>
        <div className={css.emptyCard}>
          <div className={css.emptyTitle}>{t('view.livegraph')}</div>
          <p className={css.emptyBody}>{t('emptyGraph')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={css.panel} tabIndex={0} onKeyDown={onKey}>
      <div className={css.header}>
        {sessions.length > 1 ? (
          <select
            className={css.runPick}
            value={sessionName ?? ''}
            onChange={(e) => { selectSession(e.target.value); setSelectedKey(null) }}
            title={t('sessionPick')}
          >
            {sessions.map(s => (
              <option key={s.name} value={s.name}>{s.runtime ? '● ' : '○ '}{s.name}</option>
            ))}
          </select>
        ) : <span className={css.headTitle}>{sessionName}</span>}
        <span className={`${css.feedDot} ${model.live ? css.feedLive : css.feedOff}`} />
        <span className={css.headSub}>{model.live ? t('sub') : t('sealedFallback')}</span>
        <span className={css.spacer} />
        <span className={css.legend}>
          {(['pending', 'running', 'verified', 'failed', 'replanned'] as const).map(k => (
            <span key={k} className={css.legendItem}>
              <span className={`${css.legendDot} ${STATUS_CLASS[k]}`} />{t(`legend.${k}` as const)}
            </span>
          ))}
        </span>
      </div>
      <Scrubber
        runs={runs} runIndex={effIndex} run={run} playhead={headSeq === Infinity ? (run?.lastSeq ?? 0) : headSeq}
        live={live} playing={playing} showRouting={showRouting} t={t}
        onPick={pickRun} onSeek={seek} onTogglePlay={togglePlay} onGoLive={goLive}
        onToggleRouting={() => { setShowRouting(s => !s) }}
      />
      <div className={css.canvas} ref={setCanvas}>
        <ReactFlow
          key={`${sessionName}:${effIndex}:${flow.nodes.length}:${showRouting}:${geomSig}`}
          onInit={(inst) => { fitRef.current = () => { inst.fitView(fitOpts) } }}
          nodes={flow.nodes.map(n => ({
            ...n, draggable: false, connectable: false, selectable: true,
            // Fixed dimensions so React Flow frames the graph from known bounds
            // instead of measuring after paint — a serpentine reflow otherwise
            // lets fitView run against the stale flat row and clamp to the floor.
            width: NODE_SIZE[n.type].width, height: NODE_SIZE[n.type].height,
          }))}
          edges={flow.edges.map(e => ({
            id: e.id, source: e.source, target: e.target,
            sourceHandle: e.sourceHandle, targetHandle: e.targetHandle,
            type: 'smoothstep',
            animated: e.active === true,
            label: e.label,
            className: [
              e.kind === 'routing' ? css.edgeRouting : e.kind === 'branch' ? css.edgeBranch : css.edgePlan,
              e.active ? css.edgeActive : '',
            ].filter(Boolean).join(' '),
          }))}
          nodeTypes={nodeTypes}
          onNodeClick={(_e, n) => { setSelectedKey(n.id.startsWith('plan:') ? n.id.slice(5) : null) }}
          fitView
          fitViewOptions={fitOpts}
          minZoom={0.2}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnScroll={false}
          panOnScroll
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={18} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            position="bottom-right" pannable zoomable nodeStrokeWidth={2}
            nodeColor={miniColor}
            bgColor="var(--ph-bg, #fff)"
            maskColor="color-mix(in srgb, currentColor 12%, transparent)"
          />
          <ZoomCluster t={t} fitOpts={fitOpts} />
        </ReactFlow>
        {selectedNode ? <Evidence node={selectedNode} t={t} onClose={() => { setSelectedKey(null) }} /> : null}
      </div>
    </div>
  )
}
