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

import { useEffect, useMemo, useRef, useState } from 'react'
import { Background, Handle, Position, ReactFlow } from '@xyflow/react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { foldEvents, foldRuns, isRunning, layout } from './graph.ts'
import type { LiveGraphModel, NodeStatus, PlanNodeState, RoutingRow, RunInfo } from './graph.ts'
import { useLiveFeed } from './useLiveFeed.ts'
import type { FeedInjected } from './useLiveFeed.ts'
import css from './LiveGraphView.module.css'

/** The board reads the graph drives (the shared feed face). */
export type LiveGraphInjected = FeedInjected

const PLAY_MS = 300

const STATUS_CLASS: Record<NodeStatus, string> = {
  pending: css.stPending ?? '',
  running: css.stRunning ?? '',
  verified: css.stVerified ?? '',
  failed: css.stFailed ?? '',
  replanned: css.stReplanned ?? '',
}

type T = PropsLocale<'phlivegraph'>['t']

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
      <Handle type="source" position={Position.Bottom} id="out" className={css.handle} />
      <Handle type="source" position={Position.Right} id="cap" className={css.handle} />
    </div>
  )
}

function PlanNode({ data, t }: { data: { node: PlanNodeState; predicate?: string } } & PropsLocale<'phlivegraph'>) {
  const n = data.node
  return (
    <div className={`${css.node} ${css.plan} ${STATUS_CLASS[n.status]}`}>
      <Handle type="target" position={Position.Top} id="in" className={css.handle} />
      {n.status === 'running' ? <span className={css.cursorTag}>▶ {t('current')}</span> : null}
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
      <Handle type="source" position={Position.Bottom} id="out" className={css.handle} />
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
    <div className={css.scrubBar}>
      <button
        type="button"
        className={`${css.liveBadge} ${live ? css.liveOn : css.liveOff}`}
        onClick={onGoLive}
        title={t(live ? 'liveOn' : 'liveOff')}
      >
        <span className={css.liveDot} />{t(live ? 'live' : 'history')}
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
        {playing ? '❚❚' : '▶'}
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

export function LiveGraphView({
  fetchSessions, fetchSession, fetchRuntimeEvents, t,
}: ConvViewProps & InjectFace<LiveGraphInjected> & PropsLocale<'phlivegraph'>) {
  const fastRef = useRef(false)
  const { online, sessionName, feed, sessionRows, version } =
    useLiveFeed({ fetchSessions, fetchSession, fetchRuntimeEvents }, fastRef)

  // Replay controls. playhead === null means "follow the live tail".
  const [playhead, setPlayhead] = useState<number | null>(null)
  const [runIndex, setRunIndex] = useState<number | null>(null)
  const [showRouting, setShowRouting] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)

  const runs = useMemo(() => foldRuns(feed.current), [feed, version])
  const live = playhead === null && (runIndex === null || runIndex === runs.length - 1)
  const effIndex = runIndex ?? (runs.length > 0 ? runs.length - 1 : 0)
  const run: RunInfo | undefined = runs[effIndex]
  const headSeq = playhead ?? (run ? run.lastSeq : Infinity)

  const model = useMemo(() => {
    const slice = headSeq === Infinity ? feed.current : feed.current.filter(e => e.seq <= headSeq)
    return foldEvents(sessionRows.current, slice)
  }, [feed, sessionRows, version, headSeq])

  const running = live && isRunning(model)
  fastRef.current = running

  // Playback: step the playhead forward through the run's events, ~PLAY_MS each.
  useEffect(() => {
    if (!playing || !run) return
    const seqs = feed.current.filter(e => e.seq >= run.firstSeq && e.seq <= run.lastSeq).map(e => e.seq)
    const id = setInterval(() => {
      setPlayhead((prev) => {
        const from = prev ?? run.firstSeq
        const next = seqs.find(s => s > from)
        if (next === undefined) { setPlaying(false); return run.lastSeq }
        return next
      })
    }, PLAY_MS)
    return () => { clearInterval(id) }
  }, [playing, run])

  const flow = useMemo(() => layout(model, showRouting), [model, showRouting])
  const nodeTypes = useMemo(() => ({
    mission: (p: { data: { model: LiveGraphModel } }) => <MissionNode data={p.data} t={t} />,
    plan: (p: { data: { node: PlanNodeState; predicate?: string } }) => <PlanNode data={p.data} t={t} />,
    cap: (p: { data: { cap: RoutingRow } }) => <CapNode data={p.data} t={t} />,
  }), [t])

  const selectedNode = selectedKey ? model.planNodes.find(n => n.key === selectedKey) : undefined
  const pickRun = (i: number) => { setRunIndex(i); setPlayhead(runs[i] ? runs[i].lastSeq : null); setPlaying(false); setSelectedKey(null) }
  const seek = (seq: number) => { setPlayhead(seq); setRunIndex(effIndex) }
  const goLive = () => { setPlayhead(null); setRunIndex(null); setPlaying(false) }

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
    <div className={css.panel}>
      <div className={css.header}>
        <span className={css.headTitle}>{sessionName}</span>
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
        onPick={pickRun} onSeek={seek} onTogglePlay={() => { setPlaying(p => !p) }} onGoLive={goLive}
        onToggleRouting={() => { setShowRouting(s => !s) }}
      />
      <div className={css.canvas}>
        <ReactFlow
          key={`${sessionName}:${effIndex}:${flow.nodes.length}:${showRouting}`}
          nodes={flow.nodes.map(n => ({ ...n, draggable: false, connectable: false, selectable: true }))}
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
          fitViewOptions={{ padding: 0.16, maxZoom: 1 }}
          minZoom={0.2}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnScroll={false}
          panOnScroll
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={18} size={1} />
        </ReactFlow>
        {selectedNode ? <Evidence node={selectedNode} t={t} onClose={() => { setSelectedKey(null) }} /> : null}
      </div>
    </div>
  )
}
