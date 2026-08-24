/**
 * 执行图 — the live execution-graph panel. One React Flow canvas composing
 * three layers over the newest runtime session:
 *
 * - capability ROUTING (chain `capability.resolve` rows; static per mount),
 * - the TASK PLAN (`plan_built`'s full node graph, live from the feed, or the
 *   newest sealed `task.plan_complete` when the feed is absent),
 * - LIVE node/stage state animated from `runtimeEvents` (incremental cursor).
 *
 * Renders only: every status is copied from board payloads; the fold
 * (graph.ts) assembles rendering state and computes nothing.
 *
 * Poll cadence: ~1.5s while a task is in flight, backing off to ~8s idle, and
 * fully paused while the document is hidden — a live graph earns a fast poll
 * only while something moves.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Background, ReactFlow } from '@xyflow/react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { foldEvents, isRunning, layout } from './graph.ts'
import type { LiveGraphModel, NodeStatus, OpEvent, PlanNodeState, RoutingRow } from './graph.ts'
import css from './LiveGraphView.module.css'

/** The board reads the live graph drives. */
export interface LiveGraphInjected {
  fetchSessions: () => Promise<RemoteResult<unknown>>
  fetchSession: (name: string) => Promise<RemoteResult<unknown>>
  fetchRuntimeEvents: (name: string, afterSeq: number) => Promise<RemoteResult<unknown>>
}

/** Fast cadence while a task is in flight; slow while idle. A stack task runs
 * ~10s end to end, so even idle polling must not sleep through a whole run. */
const FAST_MS = 1200
const SLOW_MS = 4000

interface EventsPayload { events?: OpEvent[]; last_seq?: number; error?: string }
interface SessionSummary { name?: string }

const STATUS_CLASS: Record<NodeStatus, string> = {
  pending: css.stPending ?? '',
  running: css.stRunning ?? '',
  verified: css.stVerified ?? '',
  failed: css.stFailed ?? '',
  replanned: css.stReplanned ?? '',
}

function MissionNode({ data, t }: { data: { model: LiveGraphModel } } & PropsLocale<'phlivegraph'>) {
  const m = data.model
  const status = m.task?.status
  return (
    <div className={`${css.node} ${css.mission} ${status === 'running' ? css.stRunning : status === 'failed' ? css.stFailed : status === 'done' ? css.stVerified : css.stPending}`}>
      <div className={css.nodeTitle}>
        {m.task?.task ?? t('idle')}
        {m.task?.seed !== undefined ? <span className={css.mono}> #{m.task.seed}</span> : null}
      </div>
      <div className={css.nodeSub}>{m.goal ?? t('goal')}</div>
      <div className={css.badges}>
        {status ? <span className={css.badge}>{t(status === 'running' ? 'running' : status === 'failed' ? 'failed' : 'done')}</span> : null}
        {m.replans > 0 ? <span className={`${css.badge} ${css.badgeAmber}`}>{t('replans')} {m.replans}</span> : null}
      </div>
    </div>
  )
}

function PlanNode({ data, t }: { data: { node: PlanNodeState } } & PropsLocale<'phlivegraph'>) {
  const n = data.node
  return (
    <div className={`${css.node} ${css.plan} ${STATUS_CLASS[n.status]}`}>
      <div className={css.nodeTitle}>
        {n.skill}
        <span className={css.mono}> {n.id}</span>
      </div>
      <div className={css.stageRow}>
        {n.stages.length === 0
          ? <span className={css.nodeSub}>{t(`legend.${n.status}` as const)}</span>
          : n.stages.map(s => (
            <span key={s.name} className={`${css.stageChip} ${STATUS_CLASS[s.status]}`}>{s.name}</span>
          ))}
      </div>
      {n.steps !== undefined
        ? <div className={css.nodeSub}>{t('steps')} <span className={css.mono}>{n.steps}</span></div>
        : null}
    </div>
  )
}

function CapNode({ data, t }: { data: { cap: RoutingRow } } & PropsLocale<'phlivegraph'>) {
  const cap = data.cap
  const tail = cap.ref.split(':').pop() ?? cap.ref
  return (
    <div className={`${css.node} ${css.cap}`} title={cap.ref}>
      <div className={css.capName}>
        {cap.capability}
        {cap.privileged ? <span className={css.privDot} title={t('privileged')} /> : null}
      </div>
      <div className={`${css.nodeSub} ${css.mono}`}>{tail}</div>
    </div>
  )
}

export function LiveGraphView({
  fetchSessions, fetchSession, fetchRuntimeEvents, t,
}: ConvViewProps & InjectFace<LiveGraphInjected> & PropsLocale<'phlivegraph'>) {
  const [online, setOnline] = useState<boolean | null>(null)
  const [sessionName, setSessionName] = useState<string | null>(null)
  const [model, setModel] = useState<LiveGraphModel | null>(null)
  // Cursor + accumulated feed live in refs: polling appends, the fold derives.
  const cursor = useRef(0)
  const feed = useRef<OpEvent[]>([])
  const sessionRows = useRef<unknown>(null)
  const knownSession = useRef<string | null>(null)
  const tickNo = useRef(0)

  const load = useCallback(async () => {
    // Every board read spawns a Python storecli; keep the per-tick cost to ONE
    // spawn (the events cursor read) so the fast lane actually runs fast. The
    // session discovery + routing rows move at boot/mount cadence — refresh
    // them on a slower stride.
    tickNo.current += 1
    if (knownSession.current === null || tickNo.current % 4 === 1) {
      const s = await fetchSessions()
      if (!s.ok) { setOnline(false); return }
      setOnline(true)
      // discover_sessions is newest-first (Python); index 0, no TS sort.
      knownSession.current = ((s.value as SessionSummary[])[0])?.name ?? null
      setSessionName(knownSession.current)
    }
    const name = knownSession.current
    if (name === null) return

    const ev = await fetchRuntimeEvents(name, cursor.current)
    if (ev.ok) {
      const payload = ev.value as EventsPayload
      const lastSeq = payload.last_seq ?? 0
      if (lastSeq < cursor.current) {
        // Runtime re-booted: the feed truncated and seq restarted — reset.
        cursor.current = 0
        feed.current = []
        const again = await fetchRuntimeEvents(name, 0)
        if (again.ok) {
          const p2 = again.value as EventsPayload
          feed.current = p2.events ?? []
          cursor.current = p2.last_seq ?? 0
        }
      } else if (payload.events?.length) {
        feed.current = [...feed.current, ...payload.events]
        cursor.current = lastSeq
      }
    }
    // The routing lane changes at mount cadence (per task): refresh it on the
    // slow stride, or immediately while it is still empty.
    if (sessionRows.current === null || tickNo.current % 4 === 1) {
      const d = await fetchSession(name)
      if (d.ok) sessionRows.current = d.value
    }
    setModel(foldEvents(sessionRows.current, feed.current))
  }, [fetchSessions, fetchSession, fetchRuntimeEvents])

  // Adaptive cadence: reschedule after every tick so an in-flight task tightens
  // the loop; hidden documents skip the fetch entirely (poll.ts rules).
  const running = model !== null && isRunning(model)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let live = true
    const tick = async () => {
      if (!live) return
      if (!document.hidden) await load()
      if (!live) return
      timer = setTimeout(tick, running ? FAST_MS : SLOW_MS)
    }
    void tick()
    const onVisible = () => { if (!document.hidden) void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      live = false
      if (timer !== undefined) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, running])

  const flow = useMemo(() => (model === null ? null : layout(model)), [model])
  const nodeTypes = useMemo(() => ({
    mission: (p: { data: { model: LiveGraphModel } }) => <MissionNode data={p.data} t={t} />,
    plan: (p: { data: { node: PlanNodeState } }) => <PlanNode data={p.data} t={t} />,
    cap: (p: { data: { cap: RoutingRow } }) => <CapNode data={p.data} t={t} />,
  }), [t])

  if (online === false) return <div className={css.empty}>{t('unavailable')}</div>
  if (model === null || flow === null) return <div className={css.empty}>{t('loading')}</div>
  if (sessionName === null) return <div className={css.empty}>{t('noSession')}</div>

  return (
    <div className={css.panel}>
      <div className={css.header}>
        <span className={css.headTitle}>{sessionName}</span>
        <span className={`${css.feedDot} ${model.live ? css.feedLive : css.feedOff}`} />
        <span className={css.headSub}>
          {model.live ? t('liveFeed') : t('sealedFallback')}
        </span>
        <span className={css.spacer} />
        <span className={css.legend}>
          {(['pending', 'running', 'verified', 'failed', 'replanned'] as const).map(k => (
            <span key={k} className={css.legendItem}>
              <span className={`${css.legendDot} ${STATUS_CLASS[k]}`} />{t(`legend.${k}` as const)}
            </span>
          ))}
        </span>
      </div>
      <div className={css.canvas}>
        <ReactFlow
          key={`${flow.nodes.length}:${model.task?.brief ?? ''}:${model.task?.status ?? ''}`}
          nodes={flow.nodes.map(n => ({ ...n, draggable: false, connectable: false, selectable: true }))}
          edges={flow.edges.map(e => ({
            id: e.id, source: e.source, target: e.target,
            type: 'smoothstep',
            animated: e.kind === 'plan' && running,
            className: (e.kind === 'routing' ? css.edgeRouting : e.kind === 'verify' ? css.edgeVerify : css.edgePlan) ?? '',
          }))}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          minZoom={0.2}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnScroll={false}
          panOnScroll
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={18} size={1} />
        </ReactFlow>
      </div>
    </div>
  )
}
