/** 技能 view: one table over the board's `skills({name})` fold — record name,
 * embodiment bindings, executor keys, evidence count, limits, failure modes —
 * with a row expanding to its per-executor evidence. Renders only: every count
 * is the Python fold's, shown verbatim. */

import { useCallback, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { pickDefault } from './OperatorRail.tsx'
import { usePolledLoad } from './poll.ts'
import type { SessionSummary, SkillRow } from './types.ts'
import css from './ops.module.css'

/** The two board reads this page drives, injected by the slot registration. */
export interface SkillsInjected {
  fetchSessions: () => Promise<RemoteResult<unknown>>
  /** GET /api/board/skills for one session: the records overview rows. */
  fetchSkills: (session: string) => Promise<RemoteResult<unknown>>
}

/** `k/n` (successes over tries) of one evidence tally, the fold's numbers verbatim. */
function kn(v: { n?: number; k?: number } | undefined): string {
  return `${v?.k ?? 0}/${v?.n ?? 0}`
}

export function SkillsView({ fetchSessions, fetchSkills, t }: ConvViewProps & InjectFace<SkillsInjected> & PropsLocale<'phops'>) {
  const [rows, setRows] = useState<SkillRow[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [online, setOnline] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    try {
      const s = await fetchSessions()
      if (!s.ok) { setOnline(false); return }
      const name = pickDefault(s.value as SessionSummary[])
      if (name === null) { setOnline(true); setRows([]); return }
      const r = await fetchSkills(name)
      setOnline(r.ok)
      if (r.ok) setRows(Array.isArray(r.value) ? r.value as SkillRow[] : [])
    } catch {
      setOnline(false)
    }
  }, [fetchSessions, fetchSkills])
  usePolledLoad(load)

  if (online === false) return <div className={css.state}>{t('unavailable')}</div>
  if (rows === null) return <div className={css.state}>{t('loading')}</div>
  if (rows.length === 0) return <div className={css.state}>{t('skills.empty')}</div>
  return (
    <div className={css.page}>
      <table className={css.table}>
        <thead>
          <tr>
            <th>{t('skills.name')}</th>
            <th>{t('skills.embodiments')}</th>
            <th>{t('skills.executors')}</th>
            <th>{t('skills.evidence')}</th>
            <th>{t('skills.limits')}</th>
            <th>{t('skills.failureModes')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const key = r.name ?? String(i)
            const bindings = r.bindings ?? {}
            const evidence = r.evidence ?? {}
            const executors = [...new Set(Object.values(bindings).flat())]
            const tries = Object.values(evidence).reduce((a, e) => a + (e?.n ?? 0), 0)
            const expanded = open === key
            return [
              <tr key={key} className={`${css.rowBtn} ${expanded ? css.rowSelected : ''}`}
                onClick={() => { setOpen(expanded ? null : key) }} aria-expanded={expanded}>
                <td className={css.mono}>{r.name}</td>
                <td>{Object.keys(bindings).join(', ')}</td>
                <td className={css.mono}>{executors.join(', ')}</td>
                <td className={css.mono}>{tries}</td>
                <td className={css.mono}>{r.limits == null ? '' : JSON.stringify(r.limits)}</td>
                <td>{(r.failure_modes ?? []).join(', ')}</td>
              </tr>,
              expanded && (
                <tr key={`${key}:evidence`}>
                  <td colSpan={6} className={css.evidence}>
                    <div className={css.dim}>{t('skills.byExecutor')}</div>
                    {tries === 0
                      ? <div className={css.dim}>—</div>
                      : Object.entries(evidence).map(([emb, ev]) => (
                        <div key={emb} className={css.mono}>
                          {emb}: {kn(ev)}
                          {Object.entries(ev?.by_executor ?? {}).map(([exec, v]) => (
                            <div key={exec}>{exec}: {kn(v)}</div>
                          ))}
                        </div>
                      ))}
                  </td>
                </tr>
              ),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}
