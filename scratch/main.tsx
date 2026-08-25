/**
 * Scratch mounts for the ph panel packages: each view rendered standalone over
 * the committed board fixtures, hash-routed (#vault, #lab, #ops, …). The mock
 * fetchers return the same RemoteResult envelopes the board bridge produces.
 *
 * URL knobs (all optional):
 *   #<view>        dash | vault | lab | livegraph | ticker | ops | evolution |
 *                  cards | ledger | status | battle   (default vault)
 *   ?latency=300   delay every mock board read by N ms (throttled-RTT profile)
 *   ?locale=en     English copy (default zh)
 *   ?theme=dark    dark tokens (body[data-ds-dark-theme])
 *
 * #dash mounts DashView inside a minimal reproduction of the ConversationRoot
 * active-phase scroll/seat contract (DashHarness), so panel maximize and the
 * composer-band sash drive against the real dock + seat CSS.
 */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import {
  IconLayoutDashboard, IconBooks, IconSitemap, IconRoute, IconTimeline,
  IconMessage, IconTrendingUp, IconBox, IconBook, IconBroadcast, IconReport,
  type IconComponent,
} from '@deepseek-ai/dsh-client-ui-ph-icons'

import '../packages/client/ui-theme/src/styles/base.css'
import '../packages/client/ui-theme/src/styles/design-platform.css'
import '../packages/client/ui-theme/src/styles/scrollbar.css'
import '../packages/client/web/src/base.css'
import '../packages/client/ui-ph-vault/src/client/xyflow-base.css'
import '../packages/client/ui-ph-livegraph/src/client/xyflow-base.css'

import { VaultView } from '../packages/client/ui-ph-vault/src/client/VaultView.tsx'
import { zh as vaultZh, en as vaultEn } from '../packages/client/ui-ph-vault/src/client/locales.ts'
import { LabView } from '../packages/client/ui-ph-livegraph/src/client/LabView.tsx'
import { LiveGraphTab, TickerTab } from '../packages/client/ui-ph-livegraph/src/client/tabs.tsx'
import { zh as liveZh, en as liveEn } from '../packages/client/ui-ph-livegraph/src/client/locales.ts'
import { OperatorRail } from '../packages/client/ui-ph-ops/src/client/OperatorRail.tsx'
import { zh as opsZh, en as opsEn } from '../packages/client/ui-ph-ops/src/client/locales.ts'
import { EvolutionView } from '../packages/client/ui-ph-panels/src/client/EvolutionView.tsx'
import { CardsView } from '../packages/client/ui-ph-panels/src/client/CardsView.tsx'
import { LedgerView } from '../packages/client/ui-ph-panels/src/client/LedgerView.tsx'
import { StatusBar } from '../packages/client/ui-ph-panels/src/client/StatusBar.tsx'
import { zh as panelsZh, en as panelsEn } from '../packages/client/ui-ph-panels/src/client/locales.ts'
import { BattleView } from '../packages/client/ui-ph-battle/src/client/BattleView.tsx'
import { zh as battleZh, en as battleEn } from '../packages/client/ui-ph-battle/src/client/locales.ts'

import { DashView } from '../packages/client/ui-ph-dash/src/client/DashView.tsx'
import { zh as dashZh, en as dashEn } from '../packages/client/ui-ph-dash/src/client/locales.ts'
// Plain (non-inline) so vite injects dockview's chrome; the plugin uses the
// ?inline channel, but scratch only needs the styles present.
import '../packages/client/ui-ph-dash/src/client/dockview.css'
import '../packages/client/ui-ph-dash/src/client/dockview-ph.css'
// The real seat classes, so the composer-band cap (max-height + flex-end clip)
// is exercised against production CSS, not a scratch copy.
import convCss from '../packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css'

import fixtures from './fixtures.json'

const params = new URLSearchParams(location.search)
const latency = Number(params.get('latency') ?? '0')
if (params.get('theme') === 'dark') document.body.dataset.dsDarkTheme = ''
const useEn = params.get('locale') === 'en'

/** Dict-lookup stand-in for the locale service's bound `t`; missing keys show raw. */
const makeT = (zh: Record<string, string>, en: Record<string, string>) =>
  (key: string): string => (useEn ? en[key] : zh[key]) ?? key

type Ok = { ok: true; value: unknown }
type Err = { ok: false; error: { message: string } }
const settle = (r: Ok | Err): Promise<Ok | Err> =>
  latency > 0 ? new Promise((res) => setTimeout(() => res(r), latency)) : Promise.resolve(r)
const ok = (value: unknown) => settle({ ok: true, value })
const err = (message: string) => settle({ ok: false, error: { message } })
const byName = (table: Record<string, unknown>, name: string) =>
  name in table ? ok(table[name]) : err(`no fixture: ${name}`)

const F = fixtures as Record<string, any>
const board = {
  fetchSessions: () => ok(F.sessions),
  fetchSession: (name: string) => byName(F.session, name),
  fetchSessionProgress: (name: string) => byName(F.sessionProgress, name),
  fetchRuntimeStatus: (name: string) => ok(F.runtimeStatus[name] ?? null),
  fetchRuntimeEvents: (name: string, afterSeq: number) => {
    const env = F.runtimeEvents[name]
    if (env === undefined) return err(`no fixture: ${name}`)
    return ok({ ...env, events: env.events.filter((e: { seq: number }) => e.seq > afterSeq) })
  },
  fetchVault: () => ok(F.vault),
  fetchStores: () => ok(F.stores),
  fetchStore: (name: string) => byName(F.store, name),
  fetchHeldout: (name: string) => byName(F.heldout, name),
  fetchCards: () => ok(F.cards),
  fetchRounds: () => ok(F.rounds),
  fetchLedger: () => ok(F.ledger),
}

const tVault = makeT(vaultZh, vaultEn)
const tLive = makeT(liveZh, liveEn)
const tOps = makeT(opsZh, opsEn)
const tPanels = makeT(panelsZh, panelsEn)
const tBattle = makeT(battleZh, battleEn)

// Untyped on purpose: scratch is outside the tsconfig aggregates, and the
// views only read their injected fetchers + t from the composed slot props.
const anyProps = (extra: object): any => ({ ...board, ...extra })

const VIEWS: Record<string, { label: string; rail?: boolean; render: () => JSX.Element }> = {
  vault: { label: '技能库', render: () => <VaultView {...anyProps({ t: tVault })} /> },
  lab: { label: '图谱·过程流', render: () => <LabView {...anyProps({ t: tLive })} /> },
  livegraph: { label: '执行图谱', render: () => <LiveGraphTab {...anyProps({ t: tLive })} /> },
  ticker: { label: '过程流', render: () => <TickerTab {...anyProps({ t: tLive })} /> },
  ops: { label: '操作侧栏', rail: true, render: () => <OperatorRail {...anyProps({ t: tOps, wide: true })} /> },
  evolution: { label: '进化', render: () => <EvolutionView {...anyProps({ t: tPanels })} /> },
  cards: { label: '卡片', render: () => <CardsView {...anyProps({ t: tPanels })} /> },
  ledger: { label: '账本', render: () => <LedgerView {...anyProps({ t: tPanels })} /> },
  status: { label: '状态条', render: () => <StatusBar {...anyProps({ t: tPanels })} /> },
  battle: { label: '战报', render: () => <BattleView {...anyProps({ t: tBattle })} /> },
}

// Registered after VIEWS so the dash can dock the others; keyed #dash.
const DASH = { label: '实验台', render: () => <DashHarness /> }

const tDash = makeT(dashZh, dashEn)

/** Docks a stand-in `chat` (DashView's default anchor, always present in the
 * real ledger) plus every other scratch view; DashView excludes `dash` itself. */
const dashViews: Record<string, { label: string; render: () => JSX.Element }> = {
  chat: {
    label: '对话',
    render: () => (
      <div className="lab-fixture-note">
        <span className="lab-badge">fixture</span>
        <p style={{ margin: '10px 0 0' }}>
          对话面板占位 — 用于验证面板最大化与 composer 死带 sash 对着真实 dock + seat CSS 运行。
        </p>
      </div>
    ),
  },
  ...VIEWS,
}
const dashLedger = {
  list: () => Object.entries(dashViews).map(([id, v]) => ({ id, label: v.label })),
  subscribe: () => () => {},
  version: () => 0,
}
const dashRenderView = (id: string): JSX.Element | null => dashViews[id]?.render() ?? null

/** Reproduces the ConversationRoot active-phase contract the dash relies on: a
 * `[data-conversation-scroll]` host that carries the composer-band variables,
 * with the real `.composerSeat` classes and a mock composer whose inner wrapper
 * publishes --dsh-composer-height (mirroring ConversationRoot's own observer, so
 * the band cap runs against production CSS). The chip count toggles to prove the
 * reserve tracks a wrapping chip row. */
function DashHarness() {
  const [inner, setInner] = useState<HTMLDivElement | null>(null)
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const scroller = inner?.closest('[data-conversation-scroll]') as HTMLElement | null
    if (!inner || !scroller) return
    const ro = new ResizeObserver(() => {
      scroller.style.setProperty('--dsh-composer-height', `${inner.offsetHeight}px`)
    })
    ro.observe(inner)
    return () => { ro.disconnect() }
  }, [inner])
  const chip = (i: number) => <span key={i} className="lab-chip">chip {i}</span>
  return (
    <div className={convCss.root} data-phase="active" style={{ height: '100%' }}>
      <div className={convCss.scrollBody} data-conversation-scroll="" style={{ position: 'relative' }}>
        <div style={{ position: 'relative', flex: '1 1 0', minHeight: 0 }}>
          <DashView {...({ views: dashLedger, renderView: dashRenderView, t: tDash } as any)} />
        </div>
        <div className={convCss.composerSeat} data-composer-seat="">
          <div ref={setInner} className={convCss.composerSeatInner} style={{ gap: 6, padding: '8px 16px' }}>
            <span className="lab-chip-tag">composer 占位 · fixture</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} data-testid="composer-chips">
              {Array.from({ length: wide ? 16 : 4 }, (_, i) => chip(i))}
            </div>
            <button type="button" data-testid="toggle-wide" onClick={() => { setWide(w => !w) }}
              style={{ alignSelf: 'flex-start', fontSize: 11, opacity: 0.6 }}>toggle chip wrap</button>
            <textarea data-testid="composer-input" defaultValue="composer input row (stack floor)"
              className="lab-composer" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Vendored tabler glyph per tab, matched to the panel each id mounts. */
const TAB_ICON: Record<string, IconComponent> = {
  dash: IconLayoutDashboard, vault: IconBooks, lab: IconSitemap, livegraph: IconRoute,
  ticker: IconTimeline, ops: IconMessage, evolution: IconTrendingUp, cards: IconBox,
  ledger: IconBook, status: IconBroadcast, battle: IconReport,
}

/** Rewrite a URL param and reload, preserving the current #hash route. The
 * theme/latency/locale knobs are read once at module load, so a reload is how
 * they take effect — the URL stays the single source of truth for screenshots
 * and e2e drives that pass the same params. */
const setParam = (key: string, value: string | null) => {
  const url = new URL(location.href)
  if (value === null) url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  location.href = url.toString()
}

/** A labeled segmented control; the active option carries the accent fill. */
function Seg({ label, options, active, onPick }: {
  label: string; options: [string, string][]; active: string; onPick: (value: string) => void
}) {
  return (
    <div className="lab-seg" role="group" aria-label={label}>
      <span className="lab-seg-label">{label}</span>
      <div className="lab-seg-track">
        {options.map(([value, text]) => (
          <button key={value} type="button" className={value === active ? 'is-on' : ''}
            aria-pressed={value === active} onClick={() => { onPick(value) }}>{text}</button>
        ))}
      </div>
    </div>
  )
}

function Controls() {
  return (
    <div className="lab-controls">
      <Seg label="主题" active={params.get('theme') === 'dark' ? 'dark' : 'light'}
        options={[['light', '浅色'], ['dark', '深色']]}
        onPick={v => { setParam('theme', v === 'dark' ? 'dark' : null) }} />
      <Seg label="延迟" active={String(latency)}
        options={[['0', '0'], ['300', '300'], ['1500', '1500ms']]}
        onPick={v => { setParam('latency', v === '0' ? null : v) }} />
      <Seg label="语言" active={useEn ? 'en' : 'zh'}
        options={[['zh', '中'], ['en', 'EN']]}
        onPick={v => { setParam('locale', v === 'en' ? 'en' : null) }} />
      <button type="button" className="lab-refresh" title="重新拉取 board 快照"
        onClick={() => { location.reload() }}>↻ 刷新快照</button>
    </div>
  )
}

function App() {
  const [hash, setHash] = useState(location.hash.slice(1) || 'vault')
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1) || 'vault')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const nav = { dash: DASH, ...VIEWS }
  const view = nav[hash] ?? VIEWS.vault
  return (
    <>
      <header className="lab-header">
        <div className="lab-brand">
          <span className="lab-mark">PH</span>
          <span className="lab-title">
            <b>组件实验室 · Component Lab</b>
            <small>ph 面板挂真实 board 快照的隔离试验场</small>
          </span>
        </div>
        <Controls />
      </header>
      <nav className="scratch lab-tabs">
        {Object.entries(nav).map(([id, v]) => {
          const Ic = TAB_ICON[id]
          return (
            <a key={id} href={`#${id}`} className={v === view ? 'is-active' : undefined}
              aria-current={v === view ? 'page' : undefined}>
              {Ic ? <Ic size={15} /> : null}<span>{v.label}</span>
            </a>
          )
        })}
      </nav>
      {/* key remounts the view on route change so per-view polling state resets */}
      <main className={`scratch lab-stage${view.rail ? ' rail' : ''}`} key={hash}>
        <section className="lab-card">{view.render()}</section>
      </main>
      <footer className="lab-footer">
        PH 组件实验室 — 面板挂真实 board 快照的隔离试验场；控制台入口 :3081
      </footer>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
