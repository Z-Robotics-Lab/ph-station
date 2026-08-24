/** 任务台 quick chips: a row above the composer that prefills the draft with an
 * editable prompt template for a common task. Prefill only — it writes the
 * composer draft through the session input face (inputActions.setDraft) and
 * never submits; the operator edits seed/params and sends. Renders only, no
 * board reads. */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the conversation package's SessionStandardProps merge delivers
// `inputActions` (with setDraft) to every session-scope slot, this dock among
// them.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PhPanelsKey } from './locales.ts'
import css from './panels.module.css'

/** The presets: a label key and the prompt-template key it prefills. */
const CHIPS: readonly { readonly label: PhPanelsKey; readonly template: PhPanelsKey }[] = [
  { label: 'chips.stack', template: 'chips.stack.template' },
  { label: 'chips.lift', template: 'chips.lift.template' },
  { label: 'chips.battle', template: 'chips.battle.template' },
]

/** Full props of the dock entry: InputZone owner share + session standard kit
 * (inputActions) + the locale seat. */
export type TaskChipsProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'phpanels'>

export function TaskChips({ inputActions, t }: TaskChipsProps) {
  return (
    <div className={css.chips} role="group" aria-label={t('chips.title')}>
      {CHIPS.map(chip => (
        <button
          key={chip.label}
          type="button"
          className={css.chip}
          onClick={() => { inputActions.setDraft(t(chip.template)) }}
        >
          {t(chip.label)}
        </button>
      ))}
    </div>
  )
}
