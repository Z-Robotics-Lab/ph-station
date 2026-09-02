/** Strict per-session header/body content inserted into the resident conversation layout. */

import { useEffect, useSyncExternalStore } from 'react'
import clsx from 'clsx'
import { IconNewChatOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  IconBook, IconBooks, IconLayoutDashboard, IconMessage,
  IconReport, IconRoute, IconSitemap, IconTrendingUp, type IconComponent,
} from '@deepseek-ai/dsh-client-ui-ph-icons'
import type { SessionId, SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ConversationSessionHeaderSlotProps, ConversationSessionSlotProps, ConvViewOwnerProps,
} from '../contract/slots.ts'
import type { ViewTab } from '../contract/views.ts'
import { VIEW_GROUP, type ViewGroup } from './view-groups.ts'
import css from './ConversationRoot.module.css'

/** Full props composed from the strict session body contract. */
export type ConversationSessionProps = ConversationSessionSlotProps

/** Full props composed from the strict session header contract. */
export type ConversationSessionHeaderProps = ConversationSessionHeaderSlotProps

interface Breadcrumb {
  readonly id: SessionId
  readonly displayTitle: string
  readonly subagent: boolean
}

const DEFAULT_VIEW_ID = 'chat'

// A glyph per view-tab id, keyed to the conversation.view entries the cockpit
// registers. An unmapped id renders label-only (the pre-icon behavior), so a
// build contributing its own view is never forced to supply an icon.
// ponytail: central id→icon map is the deliberate shortcut; the upgrade path,
// if a build needs its own glyph, is an optional `icon` on the view registration.
const VIEW_TAB_ICONS: Readonly<Record<string, IconComponent>> = {
  lab: IconLayoutDashboard,
  chat: IconMessage,
  trajectory: IconRoute,
  livegraph: IconSitemap,
  battle: IconReport,
  evolution: IconTrendingUp,
  ledger: IconBook,
  vault: IconBooks,
  rsi: IconTrendingUp,
}

/** The tab-strip group headers, in strip order. Copy is looked up per render so
 * the labels follow the active locale like every other tab. */
const VIEW_GROUP_ORDER: readonly ViewGroup[] = ['exec', 'evo']
const VIEW_GROUP_LABEL: Readonly<Record<ViewGroup, 'group.exec' | 'group.evo'>> = {
  exec: 'group.exec',
  evo: 'group.evo',
}

/** Resolve by id; with no valid selection, default to the leftmost tab (tabs are
 * order-sorted) so a build can make its own view the first-screen default, and
 * fall back to the stable Chat view when even that is absent. */
function resolveActiveView(tabs: readonly ViewTab[], selectedId: string | null): ViewTab | undefined {
  if (selectedId !== null) {
    const hit = tabs.find(view => view.id === selectedId)
    if (hit !== undefined) return hit
  }
  return tabs[0] ?? tabs.find(view => view.id === DEFAULT_VIEW_ID)
}

function deriveAncestry(list: SessionListState, id: SessionId): readonly Breadcrumb[] {
  const chain: Breadcrumb[] = []
  const seen = new Set<SessionId>()
  let cursor: SessionId | undefined = id
  while (cursor !== undefined) {
    if (seen.has(cursor)) break
    seen.add(cursor)
    const summary: SessionSummary | undefined = list.byId[cursor]
    if (summary === undefined) break
    chain.unshift({
      id: summary.id,
      displayTitle: summary.displayTitle,
      subagent: summary.origin === 'subagent',
    })
    if (summary.origin !== 'subagent') break
    cursor = summary.parentId
  }
  return chain
}

function equalBreadcrumbs(left: readonly Breadcrumb[], right: readonly Breadcrumb[]): boolean {
  return left.length === right.length
    && left.every((item, index) => {
      const other = right.at(index)
      return other !== undefined && item.id === other.id && item.displayTitle === other.displayTitle
    })
}

/**
 * Renders Session header chrome above the resident conversation scrollport.
 * @param props - Strict Session store, view ledger, navigation, render, and locale shares.
 * @returns the hidden blank-session header or visible title and tabs.
 */
export function ConversationSessionHeader({
  sessionId, useSession, useSessions, useStore, actions,
  renderSlot, views, open, startSession, t,
}: ConversationSessionHeaderProps) {
  useSyncExternalStore(views.subscribe, views.version)
  const tabs = views.list()
  const selectedId = useStore(s => s.view)
  const active = resolveActiveView(tabs, selectedId)
  const ancestry = useSessions(s => deriveAncestry(s, sessionId), equalBreadcrumbs)
  const composerPhase = useSession(s => s.composerPhase)
  const blank = useSession(s => s.blank)
  const hideChrome = blank && composerPhase === 'blank'

  return (
    <header
      className={clsx(css.header, hideChrome && css.headerHidden)}
      aria-hidden={hideChrome || undefined}
    >
      {!hideChrome && (
        <>
          <div className={css.titleRow}>
            <div className={css.titleCluster}>
              <nav className={css.crumbs} aria-label={t('session.hierarchy')}>
                {ancestry.map((summary, index) => {
                  const last = index === ancestry.length - 1
                  const title = (
                    <button
                      type="button"
                      className={clsx(
                        css.crumb,
                        summary.subagent && css.crumbSubagent,
                        last && css.crumbCurrent,
                      )}
                      disabled={last}
                      onClick={() => { open(summary.id) }}
                    >
                      {summary.displayTitle}
                    </button>
                  )
                  const lineage = last || summary.subagent
                  const lineageOwner = {
                    lineageSessionId: summary.id,
                    displayTitle: summary.displayTitle,
                    ...last ? {} : { openTitle: () => { open(summary.id) } },
                  }
                  return (
                    <span key={summary.id} className={css.crumbSeg}>
                      {index > 0 && <span className={css.crumbSep}>/</span>}
                      {lineage
                        ? summary.subagent
                          ? renderSlot(
                            'conversation.session.header.lineage',
                            lineageOwner,
                            { fallback: title },
                          )
                          : (
                            <>
                              {title}
                              {renderSlot(
                                'conversation.session.header.lineage',
                                lineageOwner,
                                { fallback: null },
                              )}
                            </>
                          )
                        : title}
                    </span>
                  )
                })}
                {ancestry.length === 0 && <span className={css.crumbCurrent}>{sessionId}</span>}
              </nav>
              <div className={css.headerActions}>
                {renderSlot('conversation.session.header.actions', {})}
              </div>
            </div>
            <div className={css.headerUtilities}>
              {renderSlot('conversation.session.header.utilities', {})}
            </div>
          </div>
          {/* The view-tab strip always carries a persistent New Conversation
              affordance (the operator's "+新会话" tab), even when a session has
              a single view — so starting a fresh conversation never requires
              finding the sidebar. The tablist itself only appears with >1 view. */}
          <div className={css.tabsRow}>
            {tabs.length > 1 ? (
              <div className={css.tabs} role="tablist">
                {VIEW_GROUP_ORDER.flatMap((group, groupIndex) => {
                  const groupTabs = tabs.filter(viewTab => (VIEW_GROUP[viewTab.id] ?? 'exec') === group)
                  if (groupTabs.length === 0) return []
                  return [
                    <span
                      key={`group-${group}`}
                      className={clsx(css.tabGroup, groupIndex > 0 && css.tabGroupDivided)}
                    >
                      {t(VIEW_GROUP_LABEL[group])}
                    </span>,
                    ...groupTabs.map((viewTab) => {
                      const TabIcon = VIEW_TAB_ICONS[viewTab.id]
                      return (
                        <button
                          key={viewTab.id}
                          type="button"
                          role="tab"
                          aria-selected={viewTab.id === active?.id}
                          className={clsx(css.tab, viewTab.id === active?.id && css.tabActive)}
                          onClick={() => { actions.setView(viewTab.id) }}
                        >
                          {TabIcon !== undefined && <TabIcon size={14} />}
                          {viewTab.label}
                        </button>
                      )
                    }),
                  ]
                })}
              </div>
            ) : <span />}
            <button
              type="button"
              className={css.newConversation}
              aria-label={t('session.new')}
              onClick={() => { startSession() }}
            >
              <IconNewChatOutline16 size={14} />
              <span>{t('session.new')}</span>
            </button>
          </div>
        </>
      )}
    </header>
  )
}

/**
 * Renders the active Session view inside the resident scrollport and keeps
 * the input draft mirrored while blank Hero chrome is visible.
 * @param props - Strict Session input/store, view ledger, and render shares.
 * @returns the active view area, or null while the Session remains blank.
 */
export function ConversationSession({
  sessionId, useSession, useInput, inputActions, useStore, actions,
  renderSlot, views, bindDraftMirror, releaseSessionImages,
}: ConversationSessionProps) {
  useSyncExternalStore(views.subscribe, views.version)
  const tabs = views.list()
  const selectedId = useStore(s => s.view)
  const active = resolveActiveView(tabs, selectedId)
  const composerPhase = useSession(s => s.composerPhase)
  const blank = useSession(s => s.blank)
  const inputState = useInput(s => s)
  const storedDraft = useStore(s => s.draft)
  // `?? null`: persisted snapshots from before the inspect field rehydrate without it.
  const inspect = useStore(s => s.inspect ?? null)

  useEffect(() => {
    if (inputState.draft === '' && storedDraft !== '') inputActions.setDraft(storedDraft)
    const unmirror = bindDraftMirror(actions.setDraft)
    return () => { unmirror() }
    // Mount-only (deps pinned to inputActions): later store writes come from
    // the machine mirror, not this seed effect.
  }, [inputActions])

  useEffect(() => () => {
    releaseSessionImages(sessionId)
  }, [releaseSessionImages, sessionId])

  if (blank && composerPhase === 'blank') return null
  // The owner share handed to the active view. `renderView` lets a composite
  // view (the 实验台 dashboard) render its sibling views by id through this
  // same authorized renderSlot — the slot is declared once (here), so a docked
  // view could not declare it itself; delegation is plain props passing.
  const ownerProps: ConvViewOwnerProps = {
    inspect,
    onInspectDone: () => { actions.setInspect(null) },
    renderView: (id: string) => renderSlot('conversation.view', ownerProps, { only: id }),
  }
  return (
    <div className={css.viewArea}>
      {active !== undefined && renderSlot('conversation.view', ownerProps, { only: active.id })}
    </div>
  )
}
