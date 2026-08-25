/** 战报 view: campaign list + drill-down over the board Remote (renders only). */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { EmptyCard, PanelFrame, Term } from './chrome.tsx'
import css from './BattleView.module.css'

/** The three board reads the panel drives, injected by the slot registration. */
export interface BattleViewInjected {
  fetchStores: () => Promise<RemoteResult<unknown>>
  fetchStore: (name: string) => Promise<RemoteResult<unknown>>
  fetchHeldout: (name: string) => Promise<RemoteResult<unknown>>
}

// Presentation shapes over board.store JSON: field names to render, never a
// second statistics layer. Every field is optional -- a LIVE poll can land
// mid-write and board.store omits absent kinds.
interface Paired {
  base_rate?: number | null
  governed_rate?: number | null
  fixed?: number | null
  broken?: number | null
  p_value?: number | null
  n?: number | null
}
interface StoreSummary {
  name: string
  task?: string | null
  generations?: number
  promoted?: number
  heldout?: number | null
}
interface Rule { trigger_str?: string | null; recovery?: string | null }
interface Generation {
  generation?: number | null
  promoted?: boolean | null
  rule?: Rule
  dev_gate?: Paired
  dev_delta?: number | null
  blind_gate?: Paired
  blind_delta?: number | null
}
interface Prereg {
  alpha?: number | null
  dev_n?: number
  heldout_n?: number
  heldout_block?: readonly [number, number] | null
}
interface Result {
  heldout?: Paired
  heldout_delta?: number | null
  heldout_vs_blind?: Paired | null
}
interface StoreDetail {
  name?: string
  prereg?: Prereg
  generations?: Generation[]
  result?: Result
  error?: string
}
interface HeldoutBlock {
  source?: string
  block?: number | null
  paired?: Paired
  delta?: number | null
  vs_blind?: Paired | null
  judgement?: boolean | null
}
interface HeldoutBlocks { blocks?: HeldoutBlock[]; error?: string }

// Live-refresh cadence (matches ui-ph-panels' POLL_MS): human cadence, the
// campaign list changes at run speed, not sub-second.
const POLL_MS = 15000

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
/** Signed percentage-point delta (governed - base), already a rate difference. */
function pp(delta?: number | null): string {
  const d = finite(delta)
  return d === null ? '—' : `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}`
}
function pct(x?: number | null): string {
  const v = finite(x)
  return v === null ? '—' : `${(v * 100).toFixed(0)}%`
}
function pval(p?: number | null): string {
  const v = finite(p)
  if (v === null) return '—'
  return v > 0 && v < 1e-4 ? v.toExponential(1) : v.toFixed(4)
}
/** base→governed rate pair the gate measured. */
function gate(pd?: Paired): string {
  return pd === undefined ? '—' : `${pct(pd.base_rate)}→${pct(pd.governed_rate)}`
}
/** McNemar discordant pairs: fixed (b) over broken (c). */
function mcnemar(pd?: Paired): string {
  return pd === undefined ? '—' : `${pd.fixed ?? '—'}/${pd.broken ?? '—'}`
}

export function BattleView({
  fetchStores, fetchStore, fetchHeldout, t,
}: ConvViewProps & InjectFace<BattleViewInjected> & PropsLocale<'battle'>) {
  const [stores, setStores] = useState<StoreSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<StoreDetail | null>(null)
  const [heldout, setHeldout] = useState<HeldoutBlocks | null>(null)

  const loadStores = useCallback(async () => {
    try {
      const carried = await fetchStores()
      if (!carried.ok) { setError(carried.error.message); return }
      setError(null)
      setStores(carried.value as StoreSummary[])
    } catch (cause) {
      // A Remote read folds carrier failures into `ok: false`, but assembly
      // faults (arg/codec/Context) reject; without this a rejected poll would
      // leave stores null with no error and render 加载中 forever.
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [fetchStores])

  // Human-cadence poll: the first load runs regardless of visibility so a view
  // mounted while its tab is hidden still paints once; the refresh is paused
  // while hidden (a background console burns no board calls) and re-run the
  // moment it returns. A failed poll keeps the last-good list — loadStores sets
  // error without clearing stores.
  // ponytail: local twin of ui-ph-panels' usePolledLoad — kept inline so
  // ui-ph-battle needs no dependency on that package for eight lines; extract to
  // a shared package only if a third ph panel package appears.
  /* jscpd:ignore-start */
  useEffect(() => {
    const run = () => { if (!document.hidden) void loadStores() }
    void loadStores()
    const timer = setInterval(run, POLL_MS)
    document.addEventListener('visibilitychange', run)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', run)
    }
  }, [loadStores])
  /* jscpd:ignore-end */

  // Seed the right pane once the first store list lands: the board returns
  // newest-first, so stores[0] is the freshest campaign. Guarded by a ref so it
  // fires exactly once and never overrides a later manual deselect. Deliberately
  // twinned with EvolutionView per the panel-independence gate — not extracted.
  /* jscpd:ignore-start */
  const seededSelection = useRef(false)
  useEffect(() => {
    if (seededSelection.current || selected !== null) return
    const first = stores?.[0]?.name
    if (first !== undefined) { seededSelection.current = true; setSelected(first) }
  }, [stores, selected])
  /* jscpd:ignore-end */

  useEffect(() => {
    if (selected === null) { setDetail(null); setHeldout(null); return }
    let live = true
    void (async () => {
      const [d, h] = await Promise.all([fetchStore(selected), fetchHeldout(selected)])
      if (!live) return
      if (d.ok) setDetail(d.value as StoreDetail)
      if (h.ok) setHeldout(h.value as HeldoutBlocks)
    })()
    return () => { live = false }
  }, [selected, fetchStore, fetchHeldout])

  // The loading/empty scaffolds mirror ui-ph-panels by design; the ph panel
  // packages stay decoupled rather than share a chrome library.
  /* jscpd:ignore-start */
  if (stores === null) {
    return (
      <PanelFrame title={t('view.battle')} sub={t('sub.battle')}>
        <div className={css.state}>{error === null ? t('loading') : `${t('unavailable')} — ${error}`}</div>
      </PanelFrame>
    )
  }
  if (stores.length === 0) {
    return (
      <PanelFrame title={t('view.battle')} sub={t('sub.battle')}>
        <EmptyCard>{t('empty')}</EmptyCard>
      </PanelFrame>
    )
  }
  /* jscpd:ignore-end */

  return (
    <PanelFrame title={t('view.battle')} sub={t('sub.battle')}>
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
                {finite(store.heldout) === null ? '' : ` · ${t('heldout')} ${store.heldout}`}
              </span>
            </button>
          ))}
        </aside>
        {/* jscpd:ignore-end */}
        <section className={css.detail}>
          {detail === null
            ? <div className={css.state}>{t('selectStore')}</div>
            : <StoreDetailView detail={detail} heldout={heldout} t={t} />}
        </section>
      </div>
    </PanelFrame>
  )
}

function StoreDetailView({
  detail, heldout, t,
}: { detail: StoreDetail; heldout: HeldoutBlocks | null } & PropsLocale<'battle'>) {
  const prereg = detail.prereg
  const result = detail.result
  const gens = detail.generations ?? []
  const blocks = heldout?.blocks ?? []
  return (
    <>
      <header className={css.detailHead}>
        <h2 className={css.title}>{detail.name}</h2>
        {prereg === undefined ? null : (
          <div className={css.prereg}>
            <span>{t('alpha')} {prereg.alpha ?? '—'}</span>
            <span>{t('devN')} {prereg.dev_n ?? '—'}</span>
            <span>{t('heldoutN')} {prereg.heldout_n ?? '—'}</span>
            {prereg.heldout_block == null ? null
              : <span>{t('block')} {prereg.heldout_block[0]}–{prereg.heldout_block[1]}</span>}
          </div>
        )}
      </header>

      <div className={css.badgeRow}>
        <span className={css.badgeLabel}><Term label={t('heldoutBadge')} tip={t('heldout.tip')} /></span>
        {result?.heldout === undefined
          ? <span className={css.badge}>{t('noHeldout')}</span>
          : (
            <span className={css.badge}>
              {result.heldout.fixed ?? '—'}/{result.heldout.n ?? '—'} · <Term label={t('delta')} tip={t('delta.tip')} /> {pp(result.heldout_delta)}
              {' · '}{t('pValue')} {pval(result.heldout.p_value)}
              {result.heldout_vs_blind == null ? '' : ` · ${t('vsBlind')} ${pval(result.heldout_vs_blind.p_value)}`}
            </span>
          )}
      </div>

      {gens.length === 0 ? null : (
        <table className={css.table}>
          <thead>
            <tr>
              <th>{t('generation')}</th>
              <th>{t('devGate')}</th>
              <th>{t('delta')}</th>
              <th><Term label={t('mcnemar')} tip={t('mcnemar.tip')} /></th>
              <th>{t('pValue')}</th>
              <th>{t('blindGate')}</th>
              <th>{t('delta')}</th>
              <th>{t('rule')}</th>
            </tr>
          </thead>
          <tbody>
            {gens.map((g, i) => (
              <tr key={g.generation ?? i}>
                <td>
                  {g.generation ?? '—'}{' '}
                  <span className={g.promoted === true ? css.pass : css.fail}>
                    <Term label={g.promoted === true ? t('promoted') : t('rejected')} tip={t('promoted.tip')} />
                  </span>
                </td>
                <td className={css.num}>{gate(g.dev_gate)}</td>
                <td className={css.num}>{pp(g.dev_delta)}</td>
                <td className={css.num}>{mcnemar(g.dev_gate)}</td>
                <td className={css.num}>{pval(g.dev_gate?.p_value)}</td>
                <td className={css.num}>{gate(g.blind_gate)}</td>
                <td className={css.num}>{pp(g.blind_delta)}</td>
                <td className={css.rule}>{g.rule?.trigger_str ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {blocks.length === 0 ? null : (
        <>
          <div className={css.sectionHead}>{t('blocks')}</div>
          <table className={css.table}>
            <thead>
              <tr>
                <th>{t('block')}</th>
                <th>{t('devGate')}</th>
                <th>{t('delta')}</th>
                <th><Term label={t('mcnemar')} tip={t('mcnemar.tip')} /></th>
                <th>{t('pValue')}</th>
                <th>{t('vsBlind')}</th>
                <th>{t('heldoutBadge')}</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b, i) => (
                <tr key={b.block ?? i}>
                  <td className={css.num}>{b.block ?? '—'}</td>
                  <td className={css.num}>{gate(b.paired)}</td>
                  <td className={css.num}>{pp(b.delta)}</td>
                  <td className={css.num}>{mcnemar(b.paired)}</td>
                  <td className={css.num}>{pval(b.paired?.p_value)}</td>
                  <td className={css.num}>{b.vs_blind == null ? '—' : pval(b.vs_blind.p_value)}</td>
                  <td>
                    {b.judgement == null ? '—'
                      : (
                        <span className={b.judgement ? css.pass : css.fail}>
                          {b.judgement ? t('judgementPass') : t('judgementFail')}
                        </span>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}
