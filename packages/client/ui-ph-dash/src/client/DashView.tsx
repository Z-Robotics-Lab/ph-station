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

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { FunctionComponent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { DockviewReact, themeDark, themeLight } from 'dockview-react'
import type { DockviewApi, DockviewReadyEvent, IDockviewHeaderActionsProps, IDockviewPanelProps } from 'dockview-react'
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
 * corrupt store is caught and falls back to the default arrangement). v2: the
 * 2×2 grid default (图谱/过程流/轨迹/取景窗 right of chat) — bumping the key
 * retires every stored v1 arrangement so the new default actually lands. */
const LAYOUT_KEY = 'ph.dash.layout.v2'
const PERSIST_DEBOUNCE_MS = 300

/** localStorage key for the operator's composer-band reserve override. Absent →
 * the band falls back to the measured composer height. */
const RESERVE_KEY = 'ph.dash.reserve.v1'
/** Floor the sash cannot drag below: the bare input row with its chip rows
 * collapsed. The ceiling is the live measured composer height (--dsh-composer-height). */
const MIN_RESERVE = 56

/** The view the dashboard never docks: itself (no self-nesting). */
const SELF = 'dash'
/** Views with a fixed seat in the default arrangement (chat column + the 2×2
 * grid); the rest tab into the bottom-left grid cell. */
const PRIMARY: readonly string[] = ['chat', 'livegraph', 'ticker', 'trajectory', 'viewport']

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

/** Corner-out (maximize) and corner-in (restore) glyphs, inline so the dash owns
 * no icon-package dependency for its two header states. 14px, currentColor. */
const MAXIMIZE_GLYPH = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
  </svg>
)
const RESTORE_GLYPH = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 4v4a1 1 0 0 1-1 1H4M15 4v4a1 1 0 0 0 1 1h4M9 20v-4a1 1 0 0 0-1-1H4M15 20v-4a1 1 0 0 1 1-1h4" />
  </svg>
)

/** Build the per-group right-header ⤢/⤡ action bound to a locale. dockview
 * renders one instance per group header; it maximizes its own group and flips
 * to a restore glyph while any group is maximized (Esc restores globally). */
function makeMaxAction(
  t: (key: 'maximize' | 'restore') => string,
): FunctionComponent<IDockviewHeaderActionsProps> {
  return function MaxAction({ api, containerApi }: IDockviewHeaderActionsProps) {
    const [maxed, setMaxed] = useState(() => api.isMaximized())
    useEffect(() => {
      const sub = containerApi.onDidMaximizedGroupChange(() => { setMaxed(api.isMaximized()) })
      return () => { sub.dispose() }
    }, [api, containerApi])
    return (
      <button
        type="button"
        className={css.headerBtn ?? ''}
        title={maxed ? t('restore') : t('maximize')}
        aria-label={maxed ? t('restore') : t('maximize')}
        onClick={() => { if (api.isMaximized()) api.exitMaximized(); else api.maximize() }}
      >
        {maxed ? RESTORE_GLYPH : MAXIMIZE_GLYPH}
      </button>
    )
  }
}

/** The inherited scroll body that carries the composer-band variables (Chat's
 * single `[data-conversation-scroll]` host), or null when the dash renders
 * outside it (e.g. a standalone harness). */
function scrollerOf(el: HTMLElement | null): HTMLElement | null {
  return el?.closest<HTMLElement>('[data-conversation-scroll]') ?? null
}

/** The live measured composer height published by ConversationRoot, the ceiling
 * the reserve clamps to; a defensive fallback covers first paint before the
 * seat's resize observer fires. */
function composerCeiling(scroller: HTMLElement): number {
  const px = Number.parseFloat(getComputedStyle(scroller).getPropertyValue('--dsh-composer-height'))
  return Number.isFinite(px) && px > 0 ? px : 160
}

/** Lay out the default arrangement: the chat column left (composer inside it),
 * a 2×2 grid right — 图谱 top-left, 过程流 top-right, 轨迹 bottom-left, 取景窗
 * bottom-right — and every other view tabbed into the 轨迹 cell. Each grid
 * boundary is a dockview splitter (drag to resize; the layout persists). */
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
  const graph = add('livegraph', { referencePanel: 'chat', direction: 'right' }) ? 'livegraph' : 'chat'
  const flow = add('ticker', { referencePanel: graph, direction: 'right' }) ? 'ticker' : graph
  const traj = add('trajectory', { referencePanel: graph, direction: 'below' }) ? 'trajectory' : null
  add('viewport', { referencePanel: flow, direction: 'below' })
  const rest = tabs.map(t => t.id).filter(id => id !== SELF && !PRIMARY.includes(id))
  let groupAnchor: string | null = traj
  for (const id of rest) {
    const ok = groupAnchor === null
      ? add(id, { referencePanel: graph, direction: 'below' })
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
  // always calling the latest delegated renderView from the skeleton. The chat
  // panel is a column with a composer OUTLET under the transcript:
  // ConversationRoot portals its (single) composer seat into the outlet while
  // it exists, so 对话 and the input bar share one dock column and the
  // full-width reserved band under the grid disappears (the ported CSS below).
  const renderRef = useRef<(id: string) => ReactNode>(() => null)
  renderRef.current = (id: string) => {
    if (id === SELF || !renderView) return null
    if (id === 'chat') {
      return (
        <div className={css.chatCol}>
          <div className={css.chatBody}>{renderView('chat')}</div>
          <div className={css.chatComposer} data-composer-outlet="" />
        </div>
      )
    }
    return renderView(id)
  }
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

  // Cmd/Ctrl-K panel switcher: focus an already-docked panel or dock it. Keyboard
  // reach removes the pointer round-trips a 300ms-RTT remote browser makes painful.
  const [palette, setPalette] = useState(false)
  const openPanel = (id: string) => {
    const api = apiRef.current
    if (!api) return
    const panel = api.getPanel(id)
    if (panel) { panel.api.setActive(); return }
    const tab = views.list().find(v => v.id === id)
    if (tab) api.addPanel({ id, component: 'view', title: tab.label, params: { viewId: id } } as AddOpts)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPalette(p => !p)
      } else if (e.key === 'Escape') {
        const api = apiRef.current
        if (api?.hasMaximizedGroup()) { e.preventDefault(); api.exitMaximizedGroup() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [])

  // The ⤢ maximize action, memoized per locale so dockview does not remount
  // every group header each render.
  const maxAction = useMemo(() => makeMaxAction(t), [t])

  // The composer-band sash: the dock/composer boundary the operator drags to
  // reclaim the reserved band. Writing --dsh-dock-reserve on the shared scroll
  // body both shrinks the sticky composer (its max-height reads the same var)
  // and the stage's reserve, so the two never mismatch. Persisted per browser;
  // double-click clears the override back to the measured composer height.
  const stageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const scroller = scrollerOf(stageRef.current)
    if (!scroller) return
    let stored: string | null = null
    try { stored = window.localStorage.getItem(RESERVE_KEY) } catch { /* ignore */ }
    if (stored) {
      scroller.style.setProperty('--dsh-dock-reserve', stored)
      scroller.dataset.dockCapped = ''
    }
  }, [])
  const onSashDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current
    const scroller = scrollerOf(stage)
    if (!stage || !scroller) return
    e.preventDefault()
    const ceiling = composerCeiling(scroller)
    scroller.dataset.dockCapped = ''
    const onMove = (ev: PointerEvent) => {
      const reserve = Math.min(ceiling, Math.max(MIN_RESERVE, stage.getBoundingClientRect().bottom - ev.clientY))
      scroller.style.setProperty('--dsh-dock-reserve', `${Math.round(reserve)}px`)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const value = scroller.style.getPropertyValue('--dsh-dock-reserve')
      try { if (value) window.localStorage.setItem(RESERVE_KEY, value) } catch { /* ignore */ }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  const onSashReset = () => {
    const scroller = scrollerOf(stageRef.current)
    if (!scroller) return
    scroller.style.removeProperty('--dsh-dock-reserve')
    delete scroller.dataset.dockCapped
    try { window.localStorage.removeItem(RESERVE_KEY) } catch { /* ignore */ }
  }

  return (
    <RenderCtx.Provider value={renderById}>
      <div className={css.dash}>
        <div className={css.toolbar}>
          <IconLayoutDashboard size={15} className={css.toolIcon ?? ''} />
          <span className={css.toolTitle}>{t('title')}</span>
          <span className={css.toolHint}>{t('hint')}</span>
          <span className={css.spacer} />
          <button type="button" className={css.kbdHint} onClick={() => { setPalette(true) }} title={t('jump')}>⌘K</button>
          <button type="button" className={css.resetBtn} onClick={reset} title={t('resetHint')}>
            <IconLayoutOff size={14} />
            <span>{t('reset')}</span>
          </button>
        </div>
        <div className={css.stage} ref={stageRef}>
          {palette ? (
            <PalettePicker
              tabs={views.list().filter(v => v.id !== SELF)}
              onPick={(id) => { openPanel(id); setPalette(false) }}
              onClose={() => { setPalette(false) }}
              t={t}
            />
          ) : null}
          <DockviewReact
            className={`${css.dockRoot} dv-ph`}
            onReady={onReady}
            components={COMPONENTS}
            rightHeaderActionsComponent={maxAction}
            theme={dark ? themeDark : themeLight}
            // Mount only the visible panel of each group: a hidden view (its
            // xyflow canvas + board poll) stays torn down until its tab is
            // shown, so ~10 docked views never poll or render at once.
            defaultRenderer="onlyWhenVisible"
          />
          {/* The dock/composer boundary, dragged to reclaim the reserved band. */}
          <div
            className={css.sash}
            role="separator"
            aria-orientation="horizontal"
            title={t('reserveHint')}
            onPointerDown={onSashDown}
            onDoubleClick={onSashReset}
          />
        </div>
      </div>
    </RenderCtx.Provider>
  )
}

/** Cmd-K panel switcher body: a filtered list over the view ledger with
 * keyboard-only reach (↑↓ move, Enter open, Esc close). Renders nothing of its
 * own state upward — the parent owns open/closed. */
function PalettePicker(
  { tabs, onPick, onClose, t }:
  { tabs: DashViewTab[]; onPick: (id: string) => void; onClose: () => void } & PropsLocale<'phdash'>,
) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const needle = q.trim().toLowerCase()
  const shown = needle
    ? tabs.filter(v => v.label.toLowerCase().includes(needle) || v.id.toLowerCase().includes(needle))
    : tabs
  const clampedActive = shown.length === 0 ? 0 : Math.min(active, shown.length - 1)

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const pick = shown[clampedActive]; if (pick) onPick(pick.id) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div className={css.paletteScrim} onMouseDown={onClose}>
      <div className={css.palette} onMouseDown={(e) => { e.stopPropagation() }}>
        <input
          ref={inputRef}
          className={css.paletteInput}
          placeholder={t('jumpPlaceholder')}
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0) }}
          onKeyDown={onKeyDown}
        />
        {shown.length === 0
          ? <div className={css.paletteEmpty}>{t('jumpEmpty')}</div>
          : (
            <ul className={css.paletteList}>
              {shown.map((v, i) => (
                <li
                  key={v.id}
                  className={i === clampedActive ? `${css.paletteItem} ${css.paletteItemActive}` : css.paletteItem}
                  onMouseEnter={() => { setActive(i) }}
                  onMouseDown={(e) => { e.preventDefault(); onPick(v.id) }}
                >
                  <span>{v.label}</span>
                  <span className={css.paletteId}>{v.id}</span>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
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
