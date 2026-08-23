/** Status bar: a thin frame-wide strip (shell.overlay) shown across every view.
 * MODE + boot facts come from the newest runtime session's `runtime.boot` chain
 * row; the heartbeat is that session's mtime formatted as "活跃 Xs 前"; board
 * reachability is simply whether the fetch worked. Renders only — TS formats
 * the mtime into a duration but computes no business meaning from it. There is
 * deliberately NO render-window / model-serving indicator: no data source
 * exists yet (design watch-item). */

import { useCallback, useEffect, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { agoSeconds } from './format.ts'
import css from './panels.module.css'

/** The two board reads the status bar drives. */
export interface StatusInjected {
  fetchSessions: () => Promise<RemoteResult<unknown>>
  fetchSession: (name: string) => Promise<RemoteResult<unknown>>
}

interface SessionSummary { name?: string; mtime?: number | null }
interface BootRow { mode?: string | null; mount_plan_sha?: string | null; skills_manifest?: unknown[] | null }
interface SessionDetail { rows?: { 'runtime.boot'?: BootRow[] } }

export function StatusBar({
  fetchSessions, fetchSession, t,
}: InjectFace<StatusInjected> & PropsLocale<'phpanels'>) {
  const [online, setOnline] = useState<boolean | null>(null)
  const [latest, setLatest] = useState<SessionSummary | null>(null)
  const [boot, setBoot] = useState<BootRow | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    const s = await fetchSessions()
    if (!s.ok) { setOnline(false); return }
    setOnline(true)
    // discover_sessions is already newest-first (Python); index 0, no TS sort.
    const list = s.value as SessionSummary[]
    setLatest(list[0] ?? null)
  }, [fetchSessions])

  // Poll the session list at human cadence; tick every second so the heartbeat
  // duration counts up between polls (formatting only).
  useEffect(() => {
    void load()
    const poll = setInterval(() => { void load() }, 5000)
    const tick = setInterval(() => { setNow(Date.now()) }, 1000)
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [load])

  const name = latest?.name
  useEffect(() => {
    if (name === undefined) { setBoot(null); return }
    let live = true
    void (async () => {
      const d = await fetchSession(name)
      if (!live || !d.ok) return
      const rows = (d.value as SessionDetail).rows
      setBoot(rows?.['runtime.boot']?.[0] ?? null)
    })()
    return () => { live = false }
  }, [name, fetchSession])

  const secs = agoSeconds(latest?.mtime, now)
  const sha = boot?.mount_plan_sha

  return (
    <div className={css.statusBar}>
      <span className={css.statusItem}>
        <span className={css.statusLabel}>{t('mode')}</span>
        <span className={css.statusValue}>{boot?.mode ?? t('modeUnknown')}</span>
      </span>
      <span className={css.statusItem}>
        <span className={css.statusValue}>{name ?? t('noSession')}</span>
      </span>
      {secs === null ? null : (
        <span className={css.statusItem}>{t('active')} {secs}s {t('ago')}</span>
      )}
      {boot === null ? null : (
        <>
          <span className={css.statusItem}>
            <span className={css.statusLabel}>{t('skills')}</span>
            <span>{boot.skills_manifest?.length ?? 0}</span>
          </span>
          {sha ? (
            <span className={css.statusItem}>
              <span className={css.statusLabel}>{t('mountPlan')}</span>
              <span className={css.statusMono}>{sha.slice(0, 8)}</span>
            </span>
          ) : null}
        </>
      )}
      <span className={css.statusSpacer} />
      <span className={css.statusItem}>
        <span className={`${css.dot} ${online === false ? css.dotOffline : css.dotOnline}`} />
        {online === false ? t('boardOffline') : t('boardOnline')}
      </span>
    </div>
  )
}
