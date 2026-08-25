/**
 * Scratch mounts for the ph panel packages: each view rendered standalone over
 * the committed board fixtures, hash-routed (#vault, #lab, #ops, …). The mock
 * fetchers return the same RemoteResult envelopes the board bridge produces.
 *
 * URL knobs (all optional):
 *   #<view>        vault | lab | livegraph | ticker | ops | evolution | cards |
 *                  ledger | status | battle   (default vault)
 *   ?latency=300   delay every mock board read by N ms (throttled-RTT profile)
 *   ?locale=en     English copy (default zh)
 *   ?theme=dark    dark tokens (body[data-ds-dark-theme])
 *
 * DashView is not mounted: it only arranges the other views through the slot
 * renderer machinery; every panel it docks is individually mountable here.
 */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

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

function App() {
  const [hash, setHash] = useState(location.hash.slice(1) || 'vault')
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1) || 'vault')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const view = VIEWS[hash] ?? VIEWS.vault
  return (
    <>
      <nav className="scratch">
        {Object.entries(VIEWS).map(([id, v]) => (
          <a key={id} href={`#${id}`} style={v === view ? { fontWeight: 700 } : undefined}>{v.label}</a>
        ))}
      </nav>
      {/* key remounts the view on route change so per-view polling state resets */}
      <main className={`scratch${view.rail ? ' rail' : ''}`} key={hash}>{view.render()}</main>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
