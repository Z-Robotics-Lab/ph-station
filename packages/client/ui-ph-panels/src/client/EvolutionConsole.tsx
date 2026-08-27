/** 演化台 (Evolution Console): the RSI side gathered under one panel. The
 * Run-RSI launcher + chain stepper (RsiRun, this console's own inject face) sit
 * at the head; below, a sub-tab bar over three existing conversation.view
 * panels — 代际进化 (campaign progress card + per-generation Δpp), 战报 (paired
 * gate / McNemar / held-out badges), 账本 (seed-block budget) — each rendered by
 * id through the owner's renderView. Renders only: every board read stays in
 * the component it belongs to, no data logic here. */

import { useState } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { PanelFrame } from './chrome.tsx'
import type { PhPanelsKey } from './locales.ts'
import { RsiRun, type RsiConsoleInjected } from './RsiRun.tsx'
import css from './panels.module.css'

/** The RSI panels the console aggregates, in tab order. `id` is the existing
 * conversation.view entry id renderView delegates to; `label` its sub-tab copy. */
const SUBS: readonly { id: string; label: PhPanelsKey }[] = [
  { id: 'evolution', label: 'view.evolution' },
  { id: 'battle', label: 'rsi.battle' },
  { id: 'ledger', label: 'view.ledger' },
]

/**
 * The 演化台 aggregate view: the Run-RSI launcher + chain stepper over a
 * sub-tab strip that swaps between the RSI panels.
 * @param props - owner renderView delegate, the RsiRun board face, and the
 * bound phpanels translator.
 */
export function EvolutionConsole(props: ConvViewProps & InjectFace<RsiConsoleInjected> & PropsLocale<'phpanels'>) {
  const { renderView, t } = props
  const [active, setActive] = useState('evolution')
  return (
    <PanelFrame title={t('view.rsi')} sub={t('sub.rsi')}>
      <RsiRun {...props} />
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
