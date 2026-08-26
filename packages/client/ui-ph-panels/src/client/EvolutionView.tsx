/** 演进 view (RSI monitor): per-store generation Δpp timeline + the progress.md
 * rounds feed. Renders only — every delta/count is board.store's, shown verbatim
 * (×100 for pp display); no statistics computed here. */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { finite, formatAgo, pp } from './format.ts'
import { EmptyCard, PanelFrame, Term } from './chrome.tsx'
import { usePolledLoad } from './poll.ts'
import css from './panels.module.css'

/** The four board reads this panel drives, injected by the slot registration. */
export interface EvolutionInjected {
  fetchRounds: () => Promise<RemoteResult<unknown>>
  fetchStores: () => Promise<RemoteResult<unknown>>
  fetchStore: (name: string) => Promise<RemoteResult<unknown>>
  fetchCampaignProgress: () => Promise<RemoteResult<unknown>>
}

// Presentation shapes over board.store JSON (subset of the fields rendered).
interface Paired { fixed?: number | null; broken?: number | null }
interface StoreSummary { name: string; task?: string | null; generations?: number; promoted?: number }
interface Generation {
  generation?: number | null
  promoted?: boolean | null
  rule?: { trigger_str?: string | null }
  dev_gate?: Paired
  dev_delta?: number | null
  blind_delta?: number | null
}
interface StoreDetail {
  name?: string
  generations?: Generation[]
  result?: { heldout_delta?: number | null }
  error?: string
}
interface Round { round?: number | null; date?: string | null; title?: string | null; body?: string | null }
/** One live campaign heartbeat (board.store.campaign_progress row): the counts,
 * timestamps, and rolling stats are all folded python-side; this file only
 * displays them (ETA below is a pure display conversion of these fields). */
interface CampaignProgress {
  name?: string
  label?: string | null
  done?: number
  total?: number
  started_ts?: number
  updated_ts?: number
  running?: boolean
  succeeded?: number
  first_death?: Record<string, number>
}

// ponytail: fixed 40pp full-scale bar reference. Δpp bars are a glance cue, not
// a measurement; the exact signed value sits beside every bar. Swap for a
// data-driven axis only if a campaign ever exceeds it (then it just clamps).
const FULL_SCALE_PP = 40

function Bar({ label, delta }: { label: ReactNode; delta: number | null | undefined }) {
  const d = finite(delta)
  const width = d === null ? 0 : Math.min(100, (Math.abs(d) * 100 / FULL_SCALE_PP) * 100)
  return (
    <div className={css.barRow}>
      <span className={css.barLabel}>{label}</span>
      <span className={css.barTrack}>
        {d === null ? null : (
          <span
            className={`${css.barFill} ${d >= 0 ? css.barPos : css.barNeg}`}
            style={{ width: `${width}%` }}
          />
        )}
      </span>
      <span className={css.barValue}>{pp(delta)}</span>
    </div>
  )
}

/** Fast-poll cadence for the in-progress campaign card: an episode finishes
 * every few seconds under a worker pool, so the 15s panel cadence would lag the
 * heartbeat visibly. Only armed while a campaign is actually running. */
const PROGRESS_POLL_MS = 5000

export function EvolutionView({
  fetchRounds, fetchStores, fetchStore, fetchCampaignProgress, t,
}: ConvViewProps & InjectFace<EvolutionInjected> & PropsLocale<'phpanels'>) {
  const [stores, setStores] = useState<StoreSummary[] | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [progress, setProgress] = useState<CampaignProgress[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<StoreDetail | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  const loadProgress = useCallback(async () => {
    try {
      const p = await fetchCampaignProgress()
      if (p.ok) setProgress(p.value as CampaignProgress[])
    } catch {
      // keep the last-good card; the panel's own load() reports board-offline
    }
  }, [fetchCampaignProgress])

  const load = useCallback(async () => {
    void loadProgress()
    try {
      const [s, r] = await Promise.all([fetchStores(), fetchRounds()])
      if (!s.ok) { setError(s.error.message); return }
      setError(null)
      setStores(s.value as StoreSummary[])
      if (r.ok) setRounds(r.value as Round[])
    } catch (cause) {
      // A rejected Remote read (assembly fault, not carrier `ok: false`) must
      // fold into the offline state, never leave stores null on 加载中 forever.
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [fetchStores, fetchRounds, loadProgress])

  usePolledLoad(load)

  // While a campaign is running, tighten just the heartbeat read to 5s (the
  // rest of the panel keeps the 15s cadence); no interval otherwise.
  const running = progress.filter(c => c.running === true)
  const anyRunning = running.length > 0
  useEffect(() => {
    if (!anyRunning) return
    const timer = setInterval(() => { if (!document.hidden) void loadProgress() }, PROGRESS_POLL_MS)
    return () => { clearInterval(timer) }
  }, [anyRunning, loadProgress])

  // Seed the right pane once the first store list lands: the newest store by
  // mtime is usually a calibration store with no generation records, so opening
  // on stores[0] shows an empty "无演进记录" pane. Seed instead to the newest
  // store that actually has generation records (summary `generations` count);
  // fall back to newest only if none does. Guarded by a ref so it fires once and
  // never overrides a later manual deselect.
  /* jscpd:ignore-start */
  const seededSelection = useRef(false)
  useEffect(() => {
    if (seededSelection.current || selected !== null || stores === null) return
    const seed = stores.find(s => (s.generations ?? 0) > 0) ?? stores[0]
    if (seed !== undefined) { seededSelection.current = true; setSelected(seed.name) }
  }, [stores, selected])
  /* jscpd:ignore-end */

  useEffect(() => {
    if (selected === null) { setDetail(null); return }
    let live = true
    void (async () => {
      const d = await fetchStore(selected)
      if (live && d.ok) setDetail(d.value as StoreDetail)
    })()
    return () => { live = false }
  }, [selected, fetchStore])

  // The loading/empty scaffolds mirror ui-ph-battle by design; the ph panel
  // packages stay decoupled rather than share a chrome library.
  /* jscpd:ignore-start */
  if (stores === null) {
    return (
      <PanelFrame title={t('view.evolution')} sub={t('sub.evolution')}>
        <div className={css.state}>{error === null ? t('loading') : `${t('unavailable')} — ${error}`}</div>
      </PanelFrame>
    )
  }
  if (stores.length === 0) {
    return (
      <PanelFrame title={t('view.evolution')} sub={t('sub.evolution')}>
        <ProgressCards items={running} t={t} />
        <EmptyCard>{t('emptyStores')}</EmptyCard>
      </PanelFrame>
    )
  }
  /* jscpd:ignore-end */

  return (
    <PanelFrame title={t('view.evolution')} sub={t('sub.evolution')}>
      <ProgressCards items={running} t={t} />
      <div className={css.panel}>
        {/* Deliberately independent per panel: the two ph panel packages stay decoupled rather than share this sidebar. */}
        {/* jscpd:ignore-start */}
        <aside className={css.sidebar}>
          <div className={css.sidebarHead}>{t('stores')}</div>
          {stores.map(store => (
            <button
              key={store.name}
              type="button"
              className={store.name === selected ? `${css.storeRow} ${css.storeRowActive}` : css.storeRow}
              onClick={() => { setSelected(store.name) }}
            >
              <span className={css.storeName}>{store.name}</span>
              <span className={css.storeMeta}>
                {store.task ?? '—'} · {store.promoted ?? 0}/{store.generations ?? 0} {t('promoted')}
              </span>
            </button>
          ))}
        </aside>
        {/* jscpd:ignore-end */}

        <section className={css.detail}>
          <div className={css.sectionHead}>{t('generations')}</div>
          {detail === null
            ? <div className={css.state}>{t('selectStore')}</div>
            : <GenerationList detail={detail} t={t} />}

          <div className={css.sectionHead}>{t('rounds')}</div>
          {rounds.length === 0
            ? <div className={css.state}>{t('noRounds')}</div>
            : rounds.map((rd, i) => (
              <div key={rd.round ?? i} className={css.round}>
                <button
                  type="button"
                  className={css.roundHead}
                  onClick={() => { setOpen(open === rd.round ? null : (rd.round ?? null)) }}
                >
                  <span className={css.roundNum}>#{rd.round ?? '—'}</span>
                  <span className={css.roundDate}>{rd.date ?? ''}</span>
                  <span className={css.roundTitle}>{rd.title ?? ''}</span>
                </button>
                {open === rd.round && rd.body ? <div className={css.roundBody}>{rd.body}</div> : null}
              </div>
            ))}
        </section>
      </div>
    </PanelFrame>
  )
}

/** In-progress campaign cards ("进行中"): one per running heartbeat, nothing
 * rendered when no campaign is live (the card never reserves space). Progress,
 * counts, and the first-death histogram arrive folded from python; the ETA is a
 * pure display conversion — remaining episodes × the observed pace
 * ((updated_ts − started_ts) / done), no statistics computed here. */
function ProgressCards({ items, t }: { items: CampaignProgress[] } & PropsLocale<'phpanels'>) {
  if (items.length === 0) return null
  return (
    <div className={css.progressWrap}>
      {items.map((c, i) => {
        const done = finite(c.done) ?? 0
        const total = finite(c.total) ?? 0
        const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0
        const elapsed = (finite(c.updated_ts) ?? 0) - (finite(c.started_ts) ?? 0)
        const etaS = done > 0 && total > done && elapsed > 0
          ? Math.round(((total - done) * elapsed) / done)
          : null
        const deaths = Object.entries(c.first_death ?? {})
          .sort((a, b) => b[1] - a[1]).slice(0, 3)
        return (
          <div key={c.name ?? i} className={css.progressCard}>
            <div className={css.progressHead}>
              <span className={css.progressDot} />
              <span className={css.progressName}>{c.name ?? '—'}</span>
              {c.label !== null && c.label !== undefined && c.label !== ''
                ? <span className={css.progressLabel}>{c.label}</span> : null}
              <span className={css.progressCount}>{done}/{total}</span>
            </div>
            <div className={css.progressTrack}>
              <div className={css.progressFill} style={{ width: `${pct}%` }} />
            </div>
            <div className={css.progressMeta}>
              <span>{t('progressSucceeded')} {finite(c.succeeded) ?? '—'}</span>
              <span>{t('progressEta')} {etaS === null ? '—' : formatAgo(etaS)}</span>
              {deaths.length > 0 ? (
                <span className={css.progressDeaths}>
                  <Term label={t('progressFirstDeath')} tip={t('firstDeath.tip')} />
                  {deaths.map(([node, n]) => (
                    <span key={node} className={css.progressDeathChip}>{node}×{n}</span>
                  ))}
                </span>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GenerationList({ detail, t }: { detail: StoreDetail } & PropsLocale<'phpanels'>) {
  const gens = detail.generations ?? []
  const heldoutDelta = detail.result?.heldout_delta
  if (gens.length === 0 && finite(heldoutDelta) === null) {
    return <div className={css.state}>{t('noGenerations')}</div>
  }
  return (
    <>
      {finite(heldoutDelta) === null
        ? null
        : <Bar label={<Term label={t('heldoutDelta')} tip={t('heldout.tip')} />} delta={heldoutDelta} />}
      {gens.map((g, i) => (
        <div key={g.generation ?? i} className={css.genBlock}>
          <div className={css.genHead}>
            <span className={css.genTitle}>{t('generation')} {g.generation ?? '—'}</span>
            <span className={g.promoted === true ? css.pass : css.fail}>
              <Term label={g.promoted === true ? t('promoted') : t('rejected')} tip={t('promoted.tip')} />
            </span>
            <span className={css.genMeta}>
              <Term label={t('mcnemar')} tip={t('mcnemar.tip')} /> {g.dev_gate?.fixed ?? '—'}/{g.dev_gate?.broken ?? '—'}
            </span>
            {g.rule?.trigger_str ? <span className={css.genMeta}>{g.rule.trigger_str}</span> : null}
          </div>
          <Bar label={<Term label={t('devDelta')} tip={t('delta.tip')} />} delta={g.dev_delta} />
          <Bar label={<Term label={t('blindDelta')} tip={t('delta.tip')} />} delta={g.blind_delta} />
        </div>
      ))}
    </>
  )
}
