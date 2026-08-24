/**
 * 过程流 — the execution-process ticker: the same runtime feed the graph folds,
 * rendered as a newest-first timeline (plan built → node entered → stage passed
 * or failed → result). The row of the node currently running is accented and
 * tagged 当前, matching the graph's live highlight. Renders only — every line is
 * a board event copied verbatim.
 */

import { useMemo, useRef } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { OpEvent } from './graph.ts'
import type { LiveGraphInjected } from './LiveGraphView.tsx'
import { useLiveFeed } from './useLiveFeed.ts'
import css from './LiveGraphView.module.css'

type T = PropsLocale<'phlivegraph'>['t']
type Tone = 'ok' | 'fail' | 'run' | 'warn' | 'muted'

interface Row { seq: number; icon: string; text: string; sub?: string; tone: Tone }

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
    case 'replan':
      return { seq: e.seq, icon: '↻', text: `${t('tk.replan')} #${(e.replan as number) ?? 0}`, tone: 'warn' }
    case 'task_done':
    case 'plan_complete':
      return { seq: e.seq, icon: e.success === false ? '✗' : '✓',
        text: e.success === false ? t('tk.taskFailed') : t('tk.done'), tone: e.success === false ? 'fail' : 'ok' }
    case 'task_failed':
      return { seq: e.seq, icon: '✗', text: t('tk.taskFailed'), tone: 'fail' }
    default:
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

export function TickerView({
  fetchSessions, fetchSession, fetchRuntimeEvents, t,
}: ConvViewProps & InjectFace<LiveGraphInjected> & PropsLocale<'phlivegraph'>) {
  const fastRef = useRef(false)
  const { online, feed, version } = useLiveFeed({ fetchSessions, fetchSession, fetchRuntimeEvents }, fastRef)

  const active = useMemo(() => activeSeq(feed.current), [feed, version])
  fastRef.current = active !== null
  const rows = useMemo(() => {
    const out: Row[] = []
    for (const e of feed.current) { const r = tickerRow(e, t); if (r) out.push(r) }
    return out.reverse()
  }, [feed, version, t])

  return (
    <div className={css.ticker}>
      <div className={css.header}>
        <span className={css.headTitle}>{t('process')}</span>
        <span className={css.headSub}>{t('processSub')}</span>
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
              </li>
            ))}
          </ol>
        )}
    </div>
  )
}
