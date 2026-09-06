import type { EvaluationSample, SeriesPoint } from './types.ts'

/** Recorded score selected for the learning chart. */
export type LearningMetric = 'progress' | 'success'
/** Overview selector; individual epoch ids are JSON tuples. */
export const ALL_EPOCHS = 'all'

/** A contiguous run of the same frozen evaluator, never a cross-version average. */
export interface LearningEpoch {
  id: string
  firstRound: number
  lastRound: number
  objectiveId: string | null
  protocolId: string | null
  comparable: boolean
}

/** One recorded round with distinct incumbent and candidate measurements. */
export interface LearningPoint {
  round: number
  before: number | null
  policy: number | null
  candidate: number | null
  accepted: boolean
  row: SeriesPoint
}

interface EpochRows extends LearningEpoch { rows: Array<{ round: number; row: SeriesPoint }> }

function fraction(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null
}

function measurement(sample: EvaluationSample | null | undefined, metric: LearningMetric): number | null {
  if (metric === 'progress') return fraction(sample?.progress)
  const successes = sample?.successes
  const episodes = sample?.episodes
  return typeof successes === 'number' && Number.isInteger(successes) && successes >= 0
    && typeof episodes === 'number' && Number.isInteger(episodes) && episodes > 0
    ? fraction(successes / episodes) : null
}

/** Builds chart/table data from the compact board response, without estimating
 * missing evaluations or treating a rejected candidate as the active policy.
 * Null evaluations leave gaps within an epoch. Unidentified evaluations are
 * isolated, so their numerical results cannot imply cross-round comparability.
 * The overview retains history with a line break at each evaluator boundary.
 * Invalid or expired epoch selection falls back to the newest epoch.
 * @param series Recorded rounds from the board.
 * @param metric Measurement to display.
 * @param selectedEpochId Evaluator epoch, or ALL_EPOCHS for segmented history.
 * @returns Evaluator groups, measured points, separated line segments and round domain.
 */
export function buildLearningSeries(series: SeriesPoint[], metric: LearningMetric, selectedEpochId?: string | null): {
  epochs: LearningEpoch[]
  epoch: LearningEpoch | null
  allEpochs: boolean
  points: LearningPoint[]
  policySegments: Array<Array<{ round: number; value: number }>>
  domain: [number, number]
} {
  // A poll may deliver out-of-order rows; a later duplicate replaces its earlier snapshot.
  const rounds = new Map<number, SeriesPoint>()
  series.forEach((row, i) => {
    const round = row.round ?? i + 1
    if (Number.isInteger(round) && round > 0) rounds.set(round, row)
  })
  const groups: EpochRows[] = []
  for (const [round, row] of [...rounds].sort(([a], [b]) => a - b)) {
    const objectiveId = row.evaluation?.objective_id || null
    const protocolId = row.evaluation?.protocol_id || null
    const comparable = objectiveId !== null && protocolId !== null
    const previous = groups.at(-1)
    const matches = previous && (row.evaluation == null || (comparable && previous.comparable
      && previous.objectiveId === objectiveId && previous.protocolId === protocolId))
    if (matches) {
      previous.lastRound = round
      previous.rows.push({ round, row })
    } else {
      groups.push({ id: JSON.stringify([round, protocolId, objectiveId]), firstRound: round, lastRound: round,
        objectiveId, protocolId, comparable, rows: [{ round, row }] })
    }
  }
  const allEpochs = selectedEpochId === ALL_EPOCHS
  const selected = allEpochs ? undefined : groups.find(group => group.id === selectedEpochId) ?? groups.at(-1)
  const epochs: LearningEpoch[] = groups.map(({ rows: _rows, ...epoch }) => epoch)
  const epoch = epochs.find(item => item.id === selected?.id) ?? null
  const points: LearningPoint[] = (allEpochs ? groups.flatMap(group => group.rows) : selected?.rows ?? []).map(({ round, row }) => {
    const accepted = row.evaluation?.acceptance != null
      ? row.evaluation.acceptance.accepted === true : row.accepted === true
    return { round, row, accepted,
      before: measurement(row.evaluation?.before, metric),
      policy: measurement(accepted ? row.evaluation?.after : row.evaluation?.before, metric),
      candidate: measurement(row.evaluation?.after, metric) }
  })
  const policySegments: Array<Array<{ round: number; value: number }>> = []
  const boundaries = new Set(groups.map(group => group.firstRound))
  let segment: Array<{ round: number; value: number }> = []
  for (const point of points) {
    const previous = segment.at(-1)
    if (point.policy === null || boundaries.has(point.round) || (previous && point.round !== previous.round + 1)) {
      segment = []
    }
    if (point.policy !== null) {
      if (!segment.length) policySegments.push(segment)
      segment.push({ round: point.round, value: point.policy })
    }
  }
  const first = points.at(0)?.round ?? 0
  const last = points.at(-1)?.round ?? first
  const domain: [number, number] = first === last ? [first - 0.5, last + 0.5] : [first, last]
  return { epochs, epoch, allEpochs, points, policySegments, domain }
}
