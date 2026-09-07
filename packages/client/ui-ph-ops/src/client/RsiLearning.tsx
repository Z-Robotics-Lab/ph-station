/** Learning history with explicit frozen-evaluator boundaries. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { ALL_EPOCHS, buildLearningSeries } from './rsi-series.ts'
import type { LearningMetric, LearningPoint } from './rsi-series.ts'
import type { SeriesPoint, Usage } from './types.ts'
import css from './ops.module.css'

type T = PropsLocale<'phops'>['t']
const PAGE_SIZE = 20
const percent = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`

/** Draws recorded policy/candidate evaluations and selects the existing detail
 * reader. View state never changes backend acceptance or fills absent samples.
 * @param props Compact history, selection callbacks, and localized labels.
 * @returns A responsive chart with keyboard-accessible paginated history.
 */
export function RsiLearning({ series, selectedRound, onPick, following, onFollow, liveRound, formatCost, t }: {
  series: SeriesPoint[]
  selectedRound: number | null
  onPick: (round: number) => void
  following: boolean
  onFollow: () => void
  liveRound: number | null
  formatCost: (usage: Usage) => string
  t: T
}) {
  const [metric, setMetric] = useState<LearningMetric>('progress')
  // default: the NEWEST evaluator epoch (the rounds that are comparable to each other);
  // the overview across all epochs is one click away
  const [epochId, setEpochId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const host = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const element = host.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => { observer.disconnect() }
  }, [])
  const { epochs, epoch, allEpochs, points, policySegments, domain } = useMemo(
    () => buildLearningSeries(series, metric, epochId), [series, metric, epochId],
  )
  const descending = [...points].reverse()
  const pages = Math.max(1, Math.ceil(points.length / PAGE_SIZE))
  const selectedIndex = descending.findIndex(point => point.round === selectedRound)
  const currentPage = Math.min(!following && selectedIndex >= 0 ? Math.floor(selectedIndex / PAGE_SIZE) : page, pages - 1)
  const visible = descending.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const selected = points.find(point => point.round === selectedRound)
  const pick = (round: number) => {
    const index = descending.findIndex(point => point.round === round)
    if (index >= 0) setPage(Math.floor(index / PAGE_SIZE))
    onPick(round)
  }
  const navigate = (event: KeyboardEvent, round: number | null) => {
    const index = points.findIndex(point => point.round === round)
    const destination = event.key === 'Home' ? points[0] : event.key === 'End' ? points.at(-1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? points[Math.max(0, index - 1)]
        : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? points[Math.min(points.length - 1, index + 1)] : undefined
    if (destination) { event.preventDefault(); pick(destination.round) }
  }
  const changePage = (next: number) => {
    setPage(next)
    const anchor = descending[next * PAGE_SIZE]
    if (anchor) onPick(anchor.round)
  }
  const verdict = (point: LearningPoint) => point.accepted ? t('rsi.learning.accepted')
    : point.row.outcome === 'error' || point.row.cycle_outcome === 'error' ? t('rsi.learning.error')
      : point.row.evaluation?.after == null ? t('rsi.learning.untested')
        : point.row.evaluation.acceptance?.accepted === false || point.row.outcome === 'same' || point.row.outcome === 'worse' ? t('rsi.learning.noUpdate') : '—'
  const W = width; const H = 320; const L = 43; const R = 18; const TOP = 16; const B = 36
  // the y axis follows the data (rounded up to 5%, at least 10%): a 8% -> 38% climb is a
  // climb, not a flat line at the bottom of a 0-100% frame
  const peak = Math.max(0, ...points.flatMap(point => [point.before, point.policy, point.candidate]).filter((v): v is number => v !== null))
  const yMax = Math.min(1, Math.max(0.1, Math.ceil(peak * 1.2 * 20) / 20))
  const x = (round: number) => L + ((round - domain[0]) / (domain[1] - domain[0] || 1)) * (W - L - R)
  const y = (value: number) => H - B - (value / yMax) * (H - B - TOP)
  const first = points[0]?.round; const last = points.at(-1)?.round
  const tickCount = width < 380 ? 3 : 6
  const ticks = first === undefined || last === undefined ? []
    : [...new Set(Array.from({ length: tickCount }, (_, i) => Math.round(first + (last - first) * i / (tickCount - 1))))]
  const pointLabel = (point: LearningPoint) => [
    t('rsi.roundN', { r: point.round }),
    `${t('rsi.learning.policy')} ${percent(point.policy)}`,
    `${t('rsi.learning.candidate')} ${percent(point.candidate)}`,
    verdict(point),
  ].join(' · ')
  return <div ref={host} className={css.learning} data-testid="rsi-learning-history">
    <div className={css.learningControls}>
      <label>{t('rsi.learning.epoch')} <select aria-label={t('rsi.learning.epoch')} value={allEpochs ? ALL_EPOCHS : epoch?.id ?? ''} onChange={(event) => {
        setEpochId(event.target.value); setPage(0)
        const chosen = epochs.find(item => item.id === event.target.value)
        const round = chosen?.lastRound ?? epochs.at(-1)?.lastRound
        if (round !== undefined) onPick(round)
      }}><option value={ALL_EPOCHS}>{t('rsi.learning.allEpochs')}</option>{epochs.map(item => <option key={item.id} value={item.id}>{item.firstRound}–{item.lastRound} · {item.objectiveId?.slice(0, 8) ?? t('rsi.learning.unidentified')}</option>)}</select></label>
      <label>{t('rsi.learning.metric')} <select aria-label={t('rsi.learning.metric')} value={metric} onChange={(event) => { setMetric(event.target.value as LearningMetric) }}>
        <option value="progress">{t('rsi.chart.objective')}</option><option value="success">{t('rsi.chart.task')}</option>
      </select></label>
      <button type="button" aria-pressed={following} onClick={() => { setEpochId(null); setPage(0); onFollow() }}>{t('rsi.learning.follow')}</button>
    </div>
    <div className={css.learningLegend}><span data-kind="policy">● {t('rsi.learning.policy')}</span><span data-kind="candidate">◇ {t('rsi.learning.candidate')}</span><span data-kind="untested">○ {t('rsi.learning.untested')}</span><span data-kind="error">○ {t('rsi.learning.error')}</span></div>
    {points.length === 1 && first !== undefined && <div className={css.chartContract}>{t('rsi.learning.singlePoint', { r: first })}</div>}
    {points.length === 0 ? <div className={css.dim}>{t('rsi.chartEmpty')}</div> : <>
      <svg className={css.learningChart} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('rsi.learning.chart')} tabIndex={0} onKeyDown={(event) => { navigate(event, selectedRound) }}>
        <title>{t('rsi.learning.chart')}</title>
        {[0, .25, .5, .75, 1].map(f => f * yMax).map(value => <g key={value}>
          <line className={css.chartGrid} x1={L} y1={y(value)} x2={W - R} y2={y(value)} />
          <text className={css.learningAxisLabel} data-axis="y" x={L - 7} y={y(value) + 4} textAnchor="end">{Math.round(value * 100)}%</text>
        </g>)}
        {ticks.map(round => <text key={round} className={css.learningAxisLabel} data-axis="x" x={x(round)} y={H - 13} textAnchor="middle">{round}</text>)}
        {allEpochs && epochs.slice(1).map(item => <line key={item.id} className={css.learningSelection} data-epoch-boundary={item.firstRound} x1={x(item.firstRound - .5)} x2={x(item.firstRound - .5)} y1={TOP} y2={H - B}><title>{t('rsi.learning.boundary', { r: item.firstRound })}</title></line>)}
        {selected && <line className={css.learningSelection} x1={x(selected.round)} x2={x(selected.round)} y1={TOP} y2={H - B} />}
        {policySegments.map((segment, index) => <polyline key={index} className={css.learningPolicy} data-series="policy" points={segment.map(point => `${x(point.round)},${y(point.value)}`).join(' ')} />)}
        {points.map(point => <g key={point.round} onClick={() => { pick(point.round) }}>
          {point.before !== null && point.candidate !== null && <line className={css.learningPair} data-pair={point.round}
            x1={x(point.round)} x2={x(point.round)} y1={y(point.before)} y2={y(point.candidate)} />}
          {point.candidate !== null && <path className={css.learningCandidate} data-point="candidate" data-round={point.round} data-value={point.candidate} d={`M${x(point.round)},${y(point.candidate) - 6} l6,6 -6,6 -6,-6 Z`} />}
          {point.policy !== null && point.policy !== point.candidate && <circle className={css.learningHit} data-pick-policy={point.round} cx={x(point.round)} cy={y(point.policy)} r={14} aria-hidden="true" />}
          {point.policy !== null && <circle className={css.learningPolicyPoint} data-point="policy" data-round={point.round} data-value={point.policy}
            data-outcome={point.row.outcome ?? undefined} data-untested={point.candidate === null ? 'true' : undefined} cx={x(point.round)} cy={y(point.policy)} r={point.candidate === null ? 4.5 : 3.5} />}
          {(point.policy !== null || point.candidate !== null) && <circle className={css.learningHit} data-pick-round={point.round} cx={x(point.round)} cy={y(point.candidate ?? point.policy ?? 0)} r={14} role="button" aria-label={pointLabel(point)} aria-pressed={selectedRound === point.round} onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(point.round) }
            else { event.stopPropagation(); navigate(event, point.round) }
          }}><title>{pointLabel(point)}</title></circle>}
        </g>)}
      </svg>
      <div className={css.learningReadout} data-testid="rsi-learning-readout">{selected ? pointLabel(selected) : t('rsi.learning.pick')}</div>
    </>}
    <div className={css.chartContract}>{allEpochs && epochs.length > 1 ? t('rsi.learning.overview') : (epoch ?? epochs[0])?.comparable ? t('rsi.learning.contract') : t('rsi.learning.unknown')}</div>
    <div data-testid="rsi-rounds">
      <h4 className={css.learningHistoryTitle}>{t('rsi.learning.history')}</h4>
      {liveRound !== null && !series.some(row => row.round === liveRound) && <button className={css.learningLive} type="button" data-round={liveRound} data-running="true" aria-pressed={selectedRound === liveRound} onClick={() => { onPick(liveRound) }}>{t('rsi.roundN', { r: liveRound })} · {t('rsi.seed.running')}</button>}
      <div className={css.learningTableViewport}>
        <table className={`${css.table} ${css.learningTable}`}>
          <thead><tr><th>{t('evolve.round')}</th><th>{t('rsi.learning.result')}</th><th>{t('rsi.learning.policy')}</th><th>{t('rsi.learning.candidate')}</th><th>{t('rsi.learning.cost')}</th></tr></thead>
          <tbody>{visible.map(point => <tr key={point.round} data-selected={point.round === selectedRound}>
            <td><button type="button" data-round={point.round} data-proposer={point.row.proposer ?? undefined} data-outcome={point.row.outcome ?? undefined} data-accepted={point.accepted ? 'true' : undefined} aria-label={t('rsi.roundN', { r: point.round })} aria-pressed={point.round === selectedRound} onClick={() => { pick(point.round) }} onKeyDown={(event) => { navigate(event, point.round) }}>{point.round}</button></td>
            <td>{verdict(point)}</td><td>{percent(point.policy)}</td><td>{percent(point.candidate)}</td><td>{point.row.usage ? formatCost(point.row.usage) : '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className={css.learningPagination}>
        <span>{t('rsi.learning.page', { page: currentPage + 1, pages, count: points.length })}</span>
        <button type="button" disabled={currentPage === 0} onClick={() => { changePage(currentPage - 1) }}>{t('rsi.learning.newer')}</button>
        <button type="button" disabled={currentPage === pages - 1} onClick={() => { changePage(currentPage + 1) }}>{t('rsi.learning.older')}</button>
      </div>
    </div>
  </div>
}
