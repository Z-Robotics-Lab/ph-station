// @vitest-environment jsdom
/** Learning history keeps chart, table and detail selection consistent. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RsiLearning } from '../src/client/RsiLearning.tsx'
import { en } from '../src/client/locales.ts'
import type { SeriesPoint } from '../src/client/types.ts'

afterEach(cleanup)
const t = ((key: keyof typeof en, params?: Record<string, unknown>) => en[key].replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k]))) as Parameters<typeof RsiLearning>[0]['t']
const row = (round: number, objective = 'current'): SeriesPoint => ({ round, evaluation: {
  protocol_id: 'fixed-v1', objective_id: objective, before: { progress: .1, successes: 0, episodes: 2 },
  after: { progress: .2, successes: 1, episodes: 2 }, acceptance: { accepted: false },
} })
const base = () => ({ selectedRound: 78, following: true, onFollow: vi.fn(), onPick: vi.fn(), liveRound: null, formatCost: () => '12 tokens · 3 s', t })
const rounds = () => [...screen.getByTestId('rsi-rounds').querySelectorAll<HTMLButtonElement>('button[data-round]')].map(button => Number(button.dataset.round))

describe('RSI learning history', () => {
  it('keeps all history visible across evaluator changes and selects a single version', () => {
    const series = Array.from({ length: 78 }, (_, i) => row(i + 1, i < 72 ? 'old' : 'current'))
    const props = base(); const { container } = render(<RsiLearning {...props} series={series} />)
    // the default view is the newest evaluator epoch; the segmented overview is the ALL option
    expect([...container.querySelectorAll('[data-axis="x"]')].map(node => node.textContent)).toEqual(['73', '74', '75', '76', '77', '78'])
    expect(container.querySelector('[data-epoch-boundary="73"]')).toBeNull()
    fireEvent.change(screen.getByRole('combobox', { name: 'Evaluation version' }), { target: { value: 'all' } })
    expect([...container.querySelectorAll('[data-axis="x"]')].map(node => node.textContent)).toEqual(['1', '16', '32', '47', '63', '78'])
    expect(rounds()).toEqual(Array.from({ length: 20 }, (_, i) => 78 - i))
    expect(container.querySelector('[data-epoch-boundary="73"]')).not.toBeNull()
    expect(screen.getByTestId('rsi-learning-readout').textContent).toContain('Current policy 10.0% · Candidate retest 20.0%')
    fireEvent.click(container.querySelector('[data-pick-round="73"]')!)
    expect(props.onPick).toHaveBeenLastCalledWith(73)
    fireEvent.change(screen.getByRole('combobox', { name: 'Metric' }), { target: { value: 'success' } })
    expect(screen.getByTestId('rsi-learning-readout').textContent).toContain('Current policy 0.0% · Candidate retest 50.0%')
    const epoch = screen.getByRole('combobox', { name: 'Evaluation version' }) as HTMLSelectElement
    fireEvent.change(epoch, { target: { value: epoch.options[1]!.value } })
    expect(props.onPick).toHaveBeenLastCalledWith(72)
    expect(rounds()).toEqual(Array.from({ length: 20 }, (_, i) => 72 - i))
    fireEvent.click(screen.getByRole('button', { name: 'Older' }))
    expect(rounds()[0]).toBe(52)
    fireEvent.click(screen.getByRole('button', { name: 'Newer' }))
    expect(rounds()[0]).toBe(72)
    fireEvent.click(screen.getByRole('button', { name: 'Follow latest' }))
    expect(props.onFollow).toHaveBeenCalledOnce()
    expect(rounds()[0]).toBe(78)
  })

  it('shows singleton points, accepted policy changes, absent retests and broken lines without interpolation', () => {
    const accepted = row(73); accepted.evaluation!.acceptance = { accepted: true }
    const noRetest = row(75); noRetest.evaluation!.after = null
    const { container } = render(
      <RsiLearning {...base()} selectedRound={75} series={[accepted, { round: 74, evaluation: null }, noRetest]} />,
    )
    expect(container.querySelectorAll('[data-series="policy"]')).toHaveLength(2)
    expect(container.querySelector('[data-point="policy"][data-round="73"]')?.getAttribute('data-value')).toBe('0.2')
    expect(container.querySelector('[data-point="candidate"][data-round="75"]')).toBeNull()
    expect(screen.getByTestId('rsi-learning-readout').textContent).toContain('Candidate retest — · Not retested')
    expect(container.querySelector('[data-pair="73"]')).not.toBeNull()
  })

  it('isolates an unidentified singleton and never derives learning values from historical node diagnostics', () => {
    const { container, rerender } = render(
      <RsiLearning {...base()} selectedRound={590}
        series={[row(589), { round: 590, evaluation: { before: { progress: 0 }, after: null } }]} />,
    )
    const epoch = screen.getByRole('combobox', { name: 'Evaluation version' }) as HTMLSelectElement
    fireEvent.change(epoch, { target: { value: 'all' } })
    expect(container.querySelectorAll('[data-series="policy"]')).toHaveLength(2)
    fireEvent.change(epoch, { target: { value: epoch.options[2]!.value } })
    expect([...container.querySelectorAll('[data-axis="x"]')].map(node => node.textContent)).toEqual(['590'])
    expect(screen.getByText(/Only round 590 has completed/)).toBeTruthy()
    expect(container.querySelector('[data-point="policy"]')?.getAttribute('data-value')).toBe('0')
    rerender(<RsiLearning {...base()} series={[{ round: 1, before: 2, after: 3, node_rate: { before: .9, after: 1 } }]} />)
    expect(container.querySelectorAll('[data-point]')).toHaveLength(0)
    expect(screen.getByTestId('rsi-rounds').textContent).toContain('—')
  })

  it('supports keyboard selection across pages and keeps an unsealed live round reachable', () => {
    const props = base()
    const { container } = render(
      <RsiLearning {...props} selectedRound={40} liveRound={41} series={Array.from({ length: 40 }, (_, i) => row(i + 1))} />,
    )
    fireEvent.keyDown(screen.getByRole('group', { name: en['rsi.learning.chart'] }), { key: 'Home' })
    expect(props.onPick).toHaveBeenLastCalledWith(1)
    expect(rounds()).toContain(1)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Round 1' }), { key: 'ArrowRight' })
    expect(props.onPick).toHaveBeenLastCalledWith(2)
    fireEvent.click(container.querySelector('button[data-running="true"]')!)
    expect(props.onPick).toHaveBeenLastCalledWith(41)
  })

  it('keeps history on a new epoch while a selected older epoch stays selected', () => {
    const props = base(); const { rerender } = render(<RsiLearning {...props} series={[row(73)]} selectedRound={73} />)
    rerender(<RsiLearning {...props} series={[row(73), row(74)]} selectedRound={74} />)
    expect(rounds()).toEqual([74, 73])
    rerender(<RsiLearning {...props} series={[row(73), row(74), row(75, 'new')]} selectedRound={75} />)
    expect(rounds()).toEqual([75])   // a new evaluator epoch is shown on its own by default
    const epoch = screen.getByRole('combobox', { name: 'Evaluation version' }) as HTMLSelectElement
    fireEvent.change(epoch, { target: { value: epoch.options[1]!.value } })
    rerender(<RsiLearning {...props} following={false} series={[row(73), row(74), row(75, 'new'), row(76, 'new')]} selectedRound={74} />)
    expect(rounds()).toEqual([74, 73])
  })

  it('anchors a paged round when new polls append rows instead of switching its detail to latest', () => {
    const props = base(); const series = Array.from({ length: 40 }, (_, i) => row(i + 1))
    const { rerender } = render(<RsiLearning {...props} selectedRound={40} series={series} />)
    fireEvent.click(screen.getByRole('button', { name: 'Older' }))
    expect(props.onPick).toHaveBeenLastCalledWith(20)
    rerender(<RsiLearning {...props} following={false} selectedRound={20} series={[...series, row(41)]} />)
    expect(rounds()).toContain(20)
    expect(screen.getByRole('button', { name: 'Round 20' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Follow latest' }).getAttribute('aria-pressed')).toBe('false')
  })
})
