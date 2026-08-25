/**
 * 实验台 — the drag-composable dashboard. It reuses the conversation.view slot
 * ledger (the same entries the tab strip lists) and renders each view into a
 * dockview panel, so chat, the 图谱·过程流 cockpit (执行图谱 ‖ 过程流), 技能库, 战报 …
 * live on ONE screen and the operator drags them to rearrange / resize / split /
 * tab. The arrangement persists per workspace in localStorage and a toolbar
 * button resets it. Renders only — every panel is an existing view rendered
 * through `renderSlot`; this file arranges, it does not compute.
 *
 * Per-experiment sync note: the 执行图谱 graph and 过程流 ticker share one run
 * selection through the livegraph RunFeedProvider. That provider lives inside
 * the `lab` view (graph ‖ ticker under one provider), which is why the default
 * layout docks `lab` as the cockpit panel — picking a run in its scrubber drives
 * both halves. The standalone 执行图谱 / 过程流 panels stay dockable; each
 * self-contains its own feed (a dashboard cannot import another plugin's
 * provider across the purity gate).
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DockviewReact, themeDark, themeLight } from 'dockview-react'
import type { DockviewApi, DockviewReadyEvent, IDockviewPanelProps } from 'dockview-react'
import { IconLayoutDashboard, IconLayoutOff } from '@deepseek-ai/dsh-client-ui-ph-icons'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './DashView.module.css'

/** One view tab projected from the conversation.view ledger. */
export interface DashViewTab { id: string; label: string }

/** The view ledger the dashboard reads (same source the tab strip reads). */
export interface DashViewLedger {
  list: () => DashViewTab[]
  subscribe: (fn: () => void) => () => void
  version: () => number
}

/** Board reads + the view ledger the dashboard entry injects. */
export interface DashInjected {
  views: DashViewLedger
}

/** Full dashboard props: base view kit (the owner share carries `renderView`,
 * the skeleton's delegated conversation.view render), the injected ledger, copy. */
export type DashViewProps =
  ConvViewProps
  & InjectFace<DashInjected>
  & PropsLocale<'phdash'>

/** localStorage key for the serialized layout (versioned; a schema drift or a
 * corrupt store is caught and falls back to the default arrangement). */
const LAYOUT_KEY = 'ph.dash.layout.v1'
const PERSIST_DEBOUNCE_MS = 300

/** The view the dashboard never docks: itself (no self-nesting). */
const SELF = 'dash'
/** Views placed as the two primary columns; the rest tab together bottom-right. */
const PRIMARY: readonly string[] = ['chat', 'lab']

type AddOpts = Parameters<DockviewApi['addPanel']>[0]

/** Render one conversation view by id; supplied to panels through context so it
 * never enters the serialized params (a function cannot survive toJSON). */
const RenderCtx = createContext<(id: string) => ReactNode>(() => null)

/** True while the app's dark token palette is active (body[data-ds-dark-theme]). */
function isDark(): boolean {
  return typeof document !== 'undefined' && document.body.hasAttribute('data-ds-dark-theme')
}

/** The dockview panel body: one existing conversation view rendered by id. */
function ViewPanel(props: IDockviewPanelProps<{ viewId: string }>) {
  const render = useContext(RenderCtx)
  return <div className={css.panelBody}>{render(props.params.viewId)}</div>
}

const COMPONENTS = { view: ViewPanel }

/** Lay out the default arrangement: chat left, the cockpit (lab) right, and
 * every other view tabbed into one bottom-right group. */
function buildDefault(api: DockviewApi, tabs: DashViewTab[]): void {
  const byId = new Map(tabs.map(t => [t.id, t]))
  const add = (id: string, position?: AddOpts['position'], inactive?: boolean): boolean => {
    const tab = byId.get(id)
    if (!tab) return false
    api.addPanel({
      id, component: 'view', title: tab.label, params: { viewId: id },
      ...(position ? { position } : {}), ...(inactive ? { inactive: true } : {}),
    } as AddOpts)
    return true
  }
  add('chat')
  const anchor = add('lab', { referencePanel: 'chat', direction: 'right' }) ? 'lab' : 'chat'
  const rest = tabs.map(t => t.id).filter(id => id !== SELF && !PRIMARY.includes(id))
  let groupAnchor: string | null = null
  for (const id of rest) {
    const ok = groupAnchor === null
      ? add(id, { referencePanel: anchor, direction: 'below' })
      : add(id, { referencePanel: groupAnchor, direction: 'within' }, true)
    if (ok && groupAnchor === null) groupAnchor = id
  }
}

/** Reconcile a restored layout with the live ledger: drop panels for views that
 * no longer exist, and dock any new view as a tab (§2.4 — never lose a panel). */
function reconcile(api: DockviewApi, tabs: DashViewTab[]): void {
  const wanted = new Set(tabs.filter(t => t.id !== SELF).map(t => t.id))
  for (const panel of [...api.panels]) {
    if (!wanted.has(panel.id)) api.removePanel(panel)
  }
  const present = new Set(api.panels.map(p => p.id))
  const anchor = api.panels[0]?.id
  for (const t of tabs) {
    if (t.id === SELF || present.has(t.id)) continue
    api.addPanel({
      id: t.id, component: 'view', title: t.label, params: { viewId: t.id },
      ...(anchor ? { position: { referencePanel: anchor, direction: 'within' }, inactive: true } : {}),
    } as AddOpts)
  }
}

export function DashView(props: DashViewProps) {
  const { views, renderView, t } = props
  const apiRef = useRef<DockviewApi | null>(null)
  const [dark, setDark] = useState(isDark)

  // The panel body renderer, held in a ref so the context value is stable while
  // always calling the latest delegated renderView from the skeleton.
  const renderRef = useRef<(id: string) => ReactNode>(() => null)
  renderRef.current = (id: string) => (id === SELF || !renderView ? null : renderView(id))
  const renderById = useRef((id: string) => renderRef.current(id)).current

  // Follow the app's light/dark palette so the dockview chrome matches.
  useEffect(() => {
    const update = () => setDark(isDark())
    const mo = new MutationObserver(update)
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    return () => { mo.disconnect() }
  }, [])

  // Reconcile the dock whenever the view ledger changes (add/remove).
  const [ledgerVersion, setLedgerVersion] = useState(() => views.version())
  useEffect(() => views.subscribe(() => { setLedgerVersion(views.version()) }), [views])
  useEffect(() => {
    const api = apiRef.current
    if (api) reconcile(api, views.list())
  }, [ledgerVersion, views])

  const onReady = (event: DockviewReadyEvent) => {
    const api = event.api
    apiRef.current = api
    const tabs = views.list()
    const stored = readStored()
    if (stored) {
      try {
        api.fromJSON(stored as Parameters<DockviewApi['fromJSON']>[0])
        reconcile(api, tabs)
      } catch {
        api.clear()
        window.localStorage.removeItem(LAYOUT_KEY)
        buildDefault(api, tabs)
      }
    } else {
      buildDefault(api, tabs)
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    api.onDidLayoutChange(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        // private mode / quota can throw — layout persistence is best-effort.
        try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(api.toJSON())) } catch { /* ignore */ }
      }, PERSIST_DEBOUNCE_MS)
    })
  }

  const reset = () => {
    const api = apiRef.current
    if (!api) return
    window.localStorage.removeItem(LAYOUT_KEY)
    api.clear()
    buildDefault(api, views.list())
  }

  return (
    <RenderCtx.Provider value={renderById}>
      <div className={css.dash}>
        <div className={css.toolbar}>
          <IconLayoutDashboard size={15} className={css.toolIcon ?? ''} />
          <span className={css.toolTitle}>{t('title')}</span>
          <span className={css.toolHint}>{t('hint')}</span>
          <span className={css.spacer} />
          <button type="button" className={css.resetBtn} onClick={reset} title={t('resetHint')}>
            <IconLayoutOff size={14} />
            <span>{t('reset')}</span>
          </button>
        </div>
        <div className={css.stage}>
          <DockviewReact
            className={`${css.dockRoot} dv-ph`}
            onReady={onReady}
            components={COMPONENTS}
            theme={dark ? themeDark : themeLight}
            // Mount only the visible panel of each group: a hidden view (its
            // xyflow canvas + board poll) stays torn down until its tab is
            // shown, so ~10 docked views never poll or render at once.
            defaultRenderer="onlyWhenVisible"
          />
        </div>
      </div>
    </RenderCtx.Provider>
  )
}

/** Read + parse the stored layout, or null when absent/unreadable. */
function readStored(): unknown {
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
