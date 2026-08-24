/** 机箱 view: the installed card grid from board/cards (each plugin's
 * manifest.toml read as data). Renders name, actuation, needs_sim, the
 * contribute counts, and a manifest summary. Honest about the doctor: no
 * status source is wired yet, so a visibly-labeled '体检: 未接入' slot stands
 * in — it is never faked. */

import { useCallback, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { usePolledLoad } from './poll.ts'
import css from './panels.module.css'

/** The single board read this panel drives. */
export interface CardsInjected {
  fetchCards: () => Promise<RemoteResult<unknown>>
}

interface Contributes {
  mounts?: string[]
  task_bindings?: string[]
  campaigns?: string[]
  bundles?: string[]
}
interface Card {
  name?: string
  dir?: string
  actuation?: string | null
  needs_sim?: boolean | null
  contributes?: Contributes
  manifest?: { third_party?: string[] | null }
}

const count = (a?: unknown[]): number => (Array.isArray(a) ? a.length : 0)

export function CardsView({
  fetchCards, t,
}: ConvViewProps & InjectFace<CardsInjected> & PropsLocale<'phpanels'>) {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const c = await fetchCards()
    if (!c.ok) { setError(c.error.message); return }
    setError(null)
    setCards(c.value as Card[])
  }, [fetchCards])

  usePolledLoad(load)

  if (cards === null) {
    return <div className={css.state}>{error === null ? t('loading') : `${t('unavailable')} — ${error}`}</div>
  }
  if (cards.length === 0) {
    return <div className={css.state}>{t('noCards')}</div>
  }

  return (
    <div className={css.grid}>
      {cards.map((card) => {
        const c = card.contributes ?? {}
        const tp = card.manifest?.third_party ?? []
        return (
          <div key={card.dir ?? card.name} className={css.card}>
            <div>
              <div className={css.cardName}>{card.name ?? '—'}</div>
              <div className={css.cardDir}>{card.dir ?? ''}</div>
            </div>
            <div className={css.badgeRow}>
              <span className={css.badge}>{t('actuation')}: {card.actuation ?? '—'}</span>
              <span className={css.badge}>{t('needsSim')}: {card.needs_sim ? t('yes') : t('no')}</span>
              {/* No doctor status source yet (scripts/plugin_doctor.py unbuilt):
                  a labeled placeholder, never a fabricated health verdict. */}
              <span className={`${css.badge} ${css.badgeMuted}`}>{t('doctor')}: {t('doctorNotWired')}</span>
            </div>
            <div className={css.kv}>
              <span><span className={css.kvLabel}>{t('mounts')}</span> {count(c.mounts)}</span>
              <span><span className={css.kvLabel}>{t('taskBindings')}</span> {count(c.task_bindings)}</span>
              <span><span className={css.kvLabel}>{t('campaigns')}</span> {count(c.campaigns)}</span>
              <span><span className={css.kvLabel}>{t('bundles')}</span> {count(c.bundles)}</span>
            </div>
            {tp.length === 0 ? null : (
              <div className={css.thirdParty}>{t('thirdParty')}: {tp.join(', ')}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
