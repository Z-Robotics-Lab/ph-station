/** 演化台 (Evolution Console): the RSI side gathered under one panel. A sub-tab
 * bar over three existing conversation.view panels — 代际进化 (campaign progress
 * card + per-generation Δpp), 战报 (paired gate / McNemar / held-out badges),
 * 账本 (seed-block budget) — each rendered by id through the owner's renderView.
 * Renders only: it arranges the existing panels, every board read stays in the
 * sub-panel it belongs to (no inject face, no data logic here). */

import { useState } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { PanelFrame } from './chrome.tsx'
import type { PhPanelsKey } from './locales.ts'
import css from './panels.module.css'

/** The RSI panels the console aggregates, in tab order. `id` is the existing
 * conversation.view entry id renderView delegates to; `label` its sub-tab copy. */
const SUBS: readonly { id: string; label: PhPanelsKey }[] = [
  { id: 'evolution', label: 'view.evolution' },
  { id: 'battle', label: 'rsi.battle' },
  { id: 'ledger', label: 'view.ledger' },
]

/**
 * The 演化台 aggregate view: a sub-tab strip that swaps between the RSI panels.
 * @param renderView - owner delegate rendering another conversation.view by id.
 * @param t - bound phpanels translator.
 */
export function EvolutionConsole({ renderView, t }: ConvViewProps & PropsLocale<'phpanels'>) {
  const [active, setActive] = useState('evolution')
  return (
    <PanelFrame title={t('view.rsi')} sub={t('sub.rsi')}>
      <div className={css.consoleTabs} role="tablist">
        {SUBS.map(s => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === active}
            className={s.id === active ? `${css.consoleTab} ${css.consoleTabActive}` : css.consoleTab}
            onClick={() => { setActive(s.id) }}
          >
            {t(s.label)}
          </button>
        ))}
      </div>
      <div className={css.consoleBody}>{renderView?.(active)}</div>
    </PanelFrame>
  )
}
