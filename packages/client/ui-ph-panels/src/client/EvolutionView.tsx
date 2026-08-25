/** 演进 view (RSI monitor): per-store generation Δpp timeline + the progress.md
 * rounds feed. Renders only — every delta/count is board.store's, shown verbatim
 * (×100 for pp display); no statistics computed here. */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { finite, pp } from './format.ts'
import { EmptyCard, PanelFrame, Term } from './chrome.tsx'
import { usePolledLoad } from './poll.ts'
import css from './panels.module.css'

/** The three board reads this panel drives, injected by the slot registration. */
export interface EvolutionInjected {
  fetchRounds: () => Promise<RemoteResult<unknown>>
  fetchStores: () => Promise<RemoteResult<unknown>>
  fetchStore: (name: string) => Promise<RemoteResult<unknown>>
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

export function EvolutionView({
  fetchRounds, fetchStores, fetchStore, t,
}: ConvViewProps & InjectFace<EvolutionInjected> & PropsLocale<'phpanels'>) {
  const [stores, setStores] = useState<StoreSummary[] | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<StoreDetail | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  const load = useCallback(async () => {
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
  }, [fetchStores, fetchRounds])

  usePolledLoad(load)

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
        <EmptyCard>{t('emptyStores')}</EmptyCard>
      </PanelFrame>
    )
  }
  /* jscpd:ignore-end */

  return (
    <PanelFrame title={t('view.evolution')} sub={t('sub.evolution')}>
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
