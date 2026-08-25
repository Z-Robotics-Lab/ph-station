/**
 * 过程流 — the execution-process ticker for ONE experiment. It reads the shared
 * {@link useRunFeed} selection, so it shows exactly the run the graph shows:
 * the `task_claimed → task_done` window of the selected run, truncated to the
 * scrubber playhead in replay. Newest-first (plan built → node entered → stage
 * passed/failed → result); the running node's row is accented and tagged 当前,
 * matching the graph's live highlight. A header line names which experiment this
 * is. Renders only — every line is a board event copied verbatim.
 */

import { useMemo } from 'react'
import { IconTimeline } from '@deepseek-ai/dsh-client-ui-ph-icons'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { OpEvent } from './graph.ts'
import { runWindow, useRunFeed } from './RunFeed.tsx'
import css from './LiveGraphView.module.css'

type T = PropsLocale<'phlivegraph'>['t']
type Tone = 'ok' | 'fail' | 'run' | 'warn' | 'muted'

interface Row { seq: number; icon: string; text: string; sub?: string; tone: Tone; time?: string }

const TONE_CLASS: Record<Tone, string> = {
  ok: css.tkOk ?? '', fail: css.tkFail ?? '', run: css.tkRun ?? '',
  warn: css.tkWarn ?? '', muted: css.tkMuted ?? '',
}

/** One feed event → one ticker line, or null to drop it (setup/unknown kinds). */
function tickerRow(e: OpEvent, t: T): Row | null {
  switch (e.kind) {
    case 'task_claimed':
      return { seq: e.seq, icon: '◆', text: `${t('tk.claimed')} ${(e.task as string) ?? ''}`,
        ...(e.seed !== undefined ? { sub: `#${e.seed as number}` } : {}), tone: 'muted' }
    case 'plan_built': {
      const n = (e.nodes as unknown[] | undefined)?.length ?? 0
      const rp = (e.replan as number) ?? 0
      return { seq: e.seq, icon: '◇',
        text: rp > 0 ? `${t('tk.replan')} #${rp} · ${n} ${t('node')}` : `${t('tk.planned')} · ${n} ${t('node')}`,
        tone: rp > 0 ? 'warn' : 'run' }
    }
    case 'node_start':
      return { seq: e.seq, icon: '▶', text: `${t('tk.enter')} ${(e.skill as string) ?? (e.node as string)}`,
        sub: e.node as string, tone: 'run' }
    case 'stage_transition':
      return { seq: e.seq, icon: e.success ? '✓' : '✗',
        text: `${t('tk.stage')} ${e.stage as string} ${e.success ? t('tk.pass') : t('tk.fail')}`,
        tone: e.success ? 'ok' : 'fail' }
    case 'actuation_end':
      return { seq: e.seq, icon: '·', text: `${t('tk.act')} ${(e.steps as number) ?? 0} ${t('tk.stepsUnit')}`, tone: 'muted' }
    case 'node_verified':
      return { seq: e.seq, icon: '✓', text: `${t('tk.verified')} ${e.node as string}`, tone: 'ok' }
    case 'node_failed':
      return { seq: e.seq, icon: '✗', text: `${t('tk.failed')} ${e.node as string}`, tone: 'fail' }
    case 'task_done':
      return { seq: e.seq, icon: e.success === false ? '✗' : '✓',
        text: e.success === false ? t('tk.taskFailed') : t('tk.done'), tone: e.success === false ? 'fail' : 'ok' }
    case 'task_failed':
      return { seq: e.seq, icon: '✗', text: t('tk.taskFailed'), tone: 'fail' }
    default:
      // Dropped on purpose alongside setup/unknown kinds: `replan` duplicates the
      // `plan_built` replan>0 row (which also carries the node count) and
      // `plan_complete` duplicates the `task_done` terminal row.
      return null
  }
}

/** Seq of the node_start whose node has not yet reached a terminal event — the
 * step the graph pulses as current, or null when nothing is in flight. */
function activeSeq(feed: readonly OpEvent[]): number | null {
  let open: { id: string; seq: number } | null = null
  for (const e of feed) {
    if (e.kind === 'node_start') open = { id: e.node as string, seq: e.seq }
    else if ((e.kind === 'node_verified' || e.kind === 'node_failed') && open && e.node === open.id) open = null
    else if (e.kind === 'task_done' || e.kind === 'task_failed') open = null
  }
  return open?.seq ?? null
}

export function TickerView({ t }: PropsLocale<'phlivegraph'>) {
  const { online, feed, version, run, runIndex, headSeq, live } = useRunFeed()

  const events = useMemo(
    () => runWindow(feed.current, run, headSeq),
    [feed, version, run, headSeq],
  )
  const active = useMemo(() => activeSeq(events), [events])
  const rows = useMemo(() => {
    // Elapsed is measured from the run's first event (task_claimed ts); omit
    // per row when either ts is absent (ts is an optional feed field).
    const firstTs = events[0]?.ts
    const out: Row[] = []
    for (const e of events) {
      const r = tickerRow(e, t)
      if (!r) continue
      if (e.ts !== undefined && firstTs !== undefined) r.time = `+${(e.ts - firstTs).toFixed(1)}s`
      out.push(r)
    }
    return out.reverse()
  }, [events, t])

  const label = run
    ? `${t('experiment')} ${runIndex + 1} · ${run.task ?? '?'} #${run.seed ?? '?'} · ${live ? t('live') : t('replay')}`
    : t('processSub')

  return (
    <div className={css.ticker}>
      <div className={css.header}>
        <IconTimeline size={14} />
        <span className={css.headTitle}>{t('process')}</span>
        <span className={css.headSub}>{label}</span>
      </div>
      {rows.length === 0
        ? <div className={css.tickerEmpty}>{t(online === false ? 'unavailable' : 'tickerEmpty')}</div>
        : (
          <ol className={css.tickerList}>
            {rows.map(r => (
              <li key={r.seq} className={`${css.tkRow} ${TONE_CLASS[r.tone]} ${r.seq === active ? css.tkActive : ''}`}>
                <span className={css.tkIcon}>{r.icon}</span>
                <span className={css.tkText}>{r.text}{r.sub ? <span className={css.tkSub}> {r.sub}</span> : null}</span>
                {r.seq === active ? <span className={css.tkCurrent}>{t('tk.current')}</span> : null}
                {r.time ? <span className={css.tkTime}>{r.time}</span> : null}
              </li>
            ))}
          </ol>
        )}
    </div>
  )
}
