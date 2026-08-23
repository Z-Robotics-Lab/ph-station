/** 账本 view: the seed-block ledger from board/ledger (STATUS.md 区块预算,
 * best-effort parsed in Python). Renders exactly the fields the endpoint
 * returns — range (lo–hi), burn state, and the source line for audit. The
 * design's "task / holdout flag" columns are intentionally absent: parse_ledger
 * does not return them (it would need a new board.store endpoint), so they are
 * not faked here. */

import { useCallback, useEffect, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { PhPanelsKey } from './locales.ts'
import css from './panels.module.css'

/** The single board read this panel drives. */
export interface LedgerInjected {
  fetchLedger: () => Promise<RemoteResult<unknown>>
}

interface Block { lo?: number | null; hi?: number | null; state?: string | null; line?: string | null }

const STATE_CLASS: Record<string, string | undefined> = {
  burned: css.burned,
  reserved: css.reserved,
  planned: css.planned,
}

export function LedgerView({
  fetchLedger, t,
}: ConvViewProps & InjectFace<LedgerInjected> & PropsLocale<'phpanels'>) {
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const l = await fetchLedger()
    if (!l.ok) { setError(l.error.message); return }
    setError(null)
    setBlocks(l.value as Block[])
  }, [fetchLedger])

  // Human-cadence poll: STATUS.md changes at hand-edit speed.
  useEffect(() => {
    void load()
    const timer = setInterval(() => { void load() }, 5000)
    return () => { clearInterval(timer) }
  }, [load])

  if (blocks === null) {
    return <div className={css.state}>{error === null ? t('loading') : `${t('unavailable')} — ${error}`}</div>
  }
  if (blocks.length === 0) {
    return <div className={css.state}>{t('noLedger')}</div>
  }

  return (
    <div className={css.detail}>
      <table className={css.table}>
        <thead>
          <tr>
            <th>{t('range')}</th>
            <th>{t('state')}</th>
            <th>{t('source')}</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b, i) => {
            const state = b.state ?? ''
            return (
              <tr key={`${b.lo}-${b.hi}-${i}`}>
                <td className={css.num}>{b.lo ?? '—'}–{b.hi ?? '—'}</td>
                <td className={STATE_CLASS[state] ?? undefined}>
                  {state ? t(state as PhPanelsKey) : '—'}
                </td>
                <td className={css.src}>{b.line ?? ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
